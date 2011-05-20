/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var Transport = require('../transport')
  , EventEmitter = process.EventEmitter
  , crypto = require('crypto')
  , parser = require('../parser');

/**
 * Export the constructor.
 */

exports = module.exports = WebSocket;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function WebSocket (mng, data) {
  // parser
  var self = this

  this.parser = new Parser();
  this.parser.on('data', function data (packet) {
    self.onMessage(parser.decodePacket(packet));
  });
  this.parser.on('close', function close () {
    self.end();
  });
  this.parser.on('error', function error () {
    self.end();
  });

  Transport.call(this, mng, data);

  this.drained = true;
}

/**
 * Inherits from Transport.
 */

WebSocket.prototype.__proto__ = Transport.prototype;

/**
 * Called when the socket connects.
 *
 * @api private
 */

WebSocket.prototype.onSocketConnect = function onSocketConnect () {
  var self = this;

  this.socket.setNoDelay(true);
  this.socket.on('drain', function () {
    self.drained = true;
  });

  this.buffer = true;
  this.buffered = [];

  if (this.req.headers.upgrade !== 'WebSocket') {
    this.log.warn('WebSocket connection invalid');
    this.end();
    return;
  }

  var origin = this.req.headers.origin
    , location = (this.socket.encrypted ? 'wss' : 'ws')
               + '://' + this.req.headers.host + this.req.url
    , waitingForNonce = false;

  if (this.req.headers['sec-websocket-key1']) {
    // If we don't have the nonce yet, wait for it (HAProxy compatibility).
    if (! (this.req.head && this.req.head.length >= 8)) {
      waitingForNonce = true;
    }

    var headers = [
        'HTTP/1.1 101 WebSocket Protocol Handshake'
      , 'Upgrade: WebSocket'
      , 'Connection: Upgrade'
      , 'Sec-WebSocket-Origin: ' + origin
      , 'Sec-WebSocket-Location: ' + location
    ];

    if (this.req.headers['sec-websocket-protocol']){
      headers.push('Sec-WebSocket-Protocol: '
          + this.req.headers['sec-websocket-protocol']);
    }
  } else {
    var headers = [
        'HTTP/1.1 101 Web Socket Protocol Handshake'
      , 'Upgrade: WebSocket'
      , 'Connection: Upgrade'
      , 'WebSocket-Origin: ' + origin
      , 'WebSocket-Location: ' + location
    ];
  }

  try {
    this.socket.write(headers.concat('', '').join('\r\n'));
    this.socket.setTimeout(0);
    this.socket.setNoDelay(true);
    this.socket.setEncoding('utf8');
  } catch (e) {
    this.end();
    return;
  }

  if (waitingForNonce) {
    this.socket.setEncoding('binary');
  } else if (this.proveReception(headers)) {
    self.flush();
  }

  var headBuffer = '';

  this.socket.on('data', function data (data) {
    if (waitingForNonce) {
      headBuffer += data;

      if (headBuffer.length < 8) {
        return;
      }

      // Restore the connection to utf8 encoding after receiving the nonce
      self.socket.setEncoding('utf8');
      waitingForNonce = false;

      // Stuff the nonce into the location where it's expected to be
      self.req.head = headBuffer.substr(0, 8);
      headBuffer = '';

      if (self.proveReception(headers)) {
        self.flush();
      }

      return;
    }

    self.parser.add(data);
  });
};

/**
 * Writes to the socket.
 *
 * @api private
 */

WebSocket.prototype.write = function write (data) {
  if (this.open) {
    this.drained = false;

    if (this.buffer) {
      this.buffered.push(data);
      return this;
    }

    try {
      this.socket.write('\u0000', 'binary');
      this.socket.write(data, 'utf8');
      this.socket.write('\uffff', 'binary');
    } catch (e) {
      this.end();
    }
  }
};

/**
 * Flushes the internal buffer
 *
 * @api private
 */

WebSocket.prototype.flush = function flush () {
  this.buffer = false;

  for (var i = 0, l = this.buffered.length; i < l; i++) {
    this.write[this.buffered.splice(0, 1)];
  }
};

/**
 * Writes a volatile message
 *
 * @api private
 */

WebSocket.prototype.writeVolatile = function writeVolatile (msg) {
  if (this.drained) {
    this.write(msg);
  } else {
    this.log.debug('ignoring volatile message, buffer not drained');
  }
};

/**
 * Finishes the handshake.
 *
 * @api private
 */

WebSocket.prototype.proveReception = function proveReception (headers) {
  var self = this
    , k1 = this.req.headers['sec-websocket-key1']
    , k2 = this.req.headers['sec-websocket-key2'];

  if (k1 && k2){
    var md5 = crypto.createHash('md5');

    [k1, k2].forEach(function decodeKeys (k) {
      var n = parseInt(k.replace(/[^\d]/g, ''))
        , spaces = k.replace(/[^ ]/g, '').length;

      if (spaces === 0 || n % spaces !== 0){
        self.log.warn('Invalid WebSocket key: "' + k + '".');
        self.end();
        return false;
      }

      n /= spaces;

      md5.update(String.fromCharCode(
        n >> 24 & 0xFF,
        n >> 16 & 0xFF,
        n >> 8  & 0xFF,
        n       & 0xFF));
    });

    md5.update(this.req.head.toString('binary'));

    try {
      this.socket.write(md5.digest('binary'), 'binary');
    } catch (e) {
      this.end();
    }
  }

  return true;
};

/**
 * Writes a payload.
 *
 * @api private
 */

WebSocket.prototype.payload = function payload (msgs) {
  for (var i = 0, l = msgs.length; i < l; i++) {
    this.write(msgs[i]);
  }

  return this;
};

/**
 * Closes the connection.
 *
 * @api private
 */

WebSocket.prototype.doClose = function doClose () {
  try {
    this.socket.write('\xff\x00', 'binary');
  } catch (e) {
    this.onClose();
  }

  this.socket.end();
};

/**
 * WebSocket parser
 *
 * @api public
 */

function Parser () {
  this.buffer = '';
  this.i = 0;
};

/**
 * Inherits from EventEmitter.
 */

Parser.prototype.__proto__ = EventEmitter.prototype;

/**
 * Adds data to the buffer.
 *
 * @api public
 */

Parser.prototype.add = function add (data) {
  this.buffer += data;
  this.parse();
};

/**
 * Parses the buffer.
 *
 * @api private
 */

Parser.prototype.parse = function parse () {
  for (var i = this.i, chr, l = this.buffer.length; i < l; i++){
    chr = this.buffer[i];

    if (this.buffer.length == 2 && this.buffer[1] == '\u0000') {
      this.emit('close');
      this.buffer = '';
      this.i = 0;
      return;
    }

    if (i === 0){
      if (chr != '\u0000')
        this.error('Bad framing. Expected null byte as first frame');
      else
        continue;
    }

    if (chr == '\ufffd'){
      this.emit('data', this.buffer.substr(1, this.buffer.length - 2));
      this.buffer = this.buffer.substr(i + 1);
      this.i = 0;
      return this.parse();
    }
  }
};

/**
 * Handles an error
 *
 * @api private
 */

Parser.prototype.error = function error (reason) {
  this.buffer = '';
  this.i = 0;
  this.emit('error', reason);
  return this;
};
