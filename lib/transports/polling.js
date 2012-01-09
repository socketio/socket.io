
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , XHR = require('./polling-xhr')
  , JSON = require('./polling-jsonp')
  , util = require('../util')
  , parser = require('../parser')
  , global = this

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Polling interface.
 *
 * @param {Object} opts
 * @api private
 */

function Polling (opts) {
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

util.inherits(Polling, Transport);

/**
 * Transport name.
 */

Polling.prototype.name = 'polling';

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function () {
  this.poll();
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon buffers are flushed and transport is paused
 * @api private
 */

Polling.prototype.pause = function (onPause) {
  var pending = 0
    , self = this

  this.readyState = 'pausing';

  function pause () {
    self.readyState = 'paused';
    onPause();
  }

  if (this.polling) {
    this.once('poll', pause);
  } else {
    pause();
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function () {
  // debug: polling
  this.polling = true;
  this.doPoll();
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function (data) {
  // if we got data we're not polling
  this.polling = false;
  this.emit('poll');

  // decode payload
  var packets = parser.decodePayload(data);

  for (var i = 0, l = packets.length; i < l; i++) {
    // if its the first message we consider the trnasport open
    if ('opening' == this.readyState) {
      this.onOpen();
    }

    // if its a close packet, we close the ongoing requests
    if ('close' == packets[i].type) {
      this.onClose();
      return;
    }

    // otherwise bypass onData and handle the message
    this.onPacket(packets[i]);
  }

  if ('open' == this.readyState) {
    this.poll();
  } else {
    // debug: ignoring poll - transport state "%s", this.readyState
  }
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function () {
  // debug: sending close packet
  this.send({ type: 'close' });
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @param {Function} drain callback
 * @api private
 */

Polling.prototype.write = function (packets, fn) {
  var self = this;
  this.writable = false;
  this.doWrite(parser.encodePayload(packets), function () {
    self.writable = true;
    fn();
  });
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

Polling.prototype.uri = function () {
  var query = util.qs(this.query)
    , schema = this.secure ? 'https' : 'http'
    , port = ''

  // avoid port if default for schema
  if (this.port && (('https' == schema && this.port != 443)
    || ('http' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.host + port + this.path + query;
};
