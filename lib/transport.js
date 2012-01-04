
/**
 * Module dependencies.
 */

var util = require('./util')
  , parser = require('./parser')
  , EventEmitter = require('./event-emitter')

/**
 * Module exports.
 */

module.exports = Transport;

/**
 * Transport abstract constructor.
 *
 * @param {Object} options.
 * @api private
 */

function Transport (opts) {
  this.path = opts.path;
  this.host = opts.host;
  this.port = opts.port;
  this.secure = opts.secure;
  this.query = opts.query;
  this.readyState = '';
  this.writeBuffer = [];
};

/**
 * Inherits from EventEmitter.
 */

util.inherits(Transport, EventEmitter);

/**
 * Whether to buffer outgoing data.
 *
 * @api public
 */

Transport.prototype.buffer = true;

/**
 * Emits an error.
 *
 * @param {String} str
 * @return {Transport} for chaining
 * @api public
 */

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
  return this;
};

/**
 * Opens the transport.
 *
 * @api public
 */

Transport.prototype.open = function () {
  if ('closed' == this.readyState || '' == this.readyState) {
    this.readyState = 'opening';
    this.doOpen();
  }

  return this;
};

/**
 * Closes the transport.
 *
 * @api private
 */

Transport.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.doClose();
    this.onClose();
  }

  return this;
};

/**
 * Sends a packet.
 *
 * @param {Object} packet
 * @api public
 */

Transport.prototype.send = function (packet) {
  if ('open' == this.readyState) {
    if (this.buffer) {
      // debug: buffering packet
      this.writeBuffer.push(packet);
    } else {
      var self = this;
      this.buffer = true;
      this.write(parser.encodePacket(data), function () {
        self.flush();
      });
    }
  } else {
    throw new Error('Transport not open');
  }

  return this;
};

/**
 * Flushes the buffer.
 *
 * @api private
 */

Transport.prototype.flush = function () {
  this.buffer = false;
  this.emit('flush');

  if (this.writeBuffer.length) {
    this.writeMany(self.writeBuffer);
    this.writeBuffer = [];
  }

  return this;
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.emit('open');
};

/**
 * Called with data.
 *
 * @param {String} data
 * @api private
 */

Transport.prototype.onData = function (data) {
  this.onPacket(parser.decodePacket(data));
};

/**
 * Called with a decoded packet.
 */

Transport.prototype.onPacket = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon close.
 *
 * @api private
 */

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};
