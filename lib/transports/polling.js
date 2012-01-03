
/**
 * Module requirements.
 */

var Transport = require('../transport')
  , parser = require('../parser')
  , debug = require('debug')('engine.transport')

/**
 * Exports the constructor.
 */

module.exports = Polling;

/**
 * HTTP polling constructor.
 *
 * @api public.
 */

function Polling (req) {
  Transport.call(this, req);
};

/**
 * Inherits from Transport.
 *
 * @api public.
 */

Polling.prototype.__proto__ = Transport.prototype;

/**
 * Transport name
 *
 * @api public
 */

Polling.prototype.name = 'polling';

/**
 * Overrides onRequest.
 *
 * @param {http.ServerRequest}
 * @api private
 */

Polling.prototype.onRequest = function (req) {
  var res = req.res;

  if ('GET' == req.method) {
    this.onPollRequest(req, res);
  } else if ('POST' == req.method) {
    this.onDataRequest(req, res);
  } else {
    res.writeHead(500);
    res.end();
  }
};

/**
 * The client sends a request awaiting for us to send data.
 *
 * @api private
 */

Polling.prototype.onPollRequest = function (req, res) {
  // if there's an ongoing poll
  if (this.req) {
    // assert: this.res, '.req and .res should be (un)set together'
    this.onError('poll overlap from client');
    res.writeHead(500);
  } else {
    this.req = req;
    this.res = res;

    var self = this;

    function onClose () {
      self.onError('poll connection closed prematurely');
    }

    function cleanup () {
      req.removeListener('close', onClose);
      self.req = self.res = null;
    }

    req.cleanup = cleanup;
    req.on('close', onClose);

    this.buffer = false;
    this.flush();
  }
};

/**
 * The client sends a request with data.
 *
 * @api private
 */

Polling.prototype.onDataRequest = function (req, res) {
  if (this.dataReq) {
    // assert: this.dataRes, '.dataReq and .dataRes should be (un)set together'
    this.onError('data request overlap from client');
    res.writeHead(500);
  } else {
    this.dataReq = req;
    this.dataRes = res;

    var chunks = ''
      , self = this

    function cleanup () {
      chunks = '';
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('close', cleanup);
      self.dataReq = self.dataRes = null;
    };

    function onClose () {
      cleanup();
      self.onError('data request connection closed prematurely');
    };

    function onData () {
      chunks += data;
    };

    function onEnd () {
      self.onData(chunks);
      res.writeHead(204);
      res.end();
      cleanup();
    };

    req.abort = cleanup;
    req.on('close', onClose);
    req.on('data', onData);
    req.on('end', onEnd);
    req.setEncoding('utf8');
  }
};

/**
 * Processes the incoming data payload.
 */

Polling.prototype.onData = function (data) {
  var packets = parser.decodePayload(data);
  for (var i = 0, l = packets.length; i < l; i++) {
    this.onPacket(packets[i]);
  }
};

/**
 * Flushes buffers.
 *
 * @api private
 */

Polling.prototype.flush = function () {
  if (this.writeBuffer) {
    this.write(parser.encodePayload(this.writeBuffer));
    this.writeBuffer = null;
  }
};

/**
 * Writes a packet.
 *
 * @param {Object} packet
 * @api private
 */

Polling.prototype.send = function (packet) {
  if (this.buffer) {
    if (!this.writeBuffer) {
      this.writeBuffer = [];
    }

    debug('poll buffering packet: type %s | data %s', packet.type, packet.data);
    this.writeBuffer.push(packet);
  } else {
    debug('poll writing packet: type %s | data %s', packet.type, packet.data);
    this.write(parser.encodePayload([packet]));
  }
};

/**
 * Writes data as response to poll request.
 *
 * @param {String} data
 * @api private
 */

Polling.prototype.write = function (data) {
  this.doWrite(data);
  this.req.cleanup();
  this.buffer = true;
};

/**
 * Writes a payload of messages
 *
 * @api private
 */

HTTPTransport.prototype.payload = function (msgs) {
  this.write(parser.encodePayload(msgs));
};
