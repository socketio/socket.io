
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
 * @api private
 */

Transport.prototype.send = function (packet) {
  if ('open' == this.readyState) {
    this.writeBuffer.push(packet);
    this.flush();
  } else {
    throw new Error('Transport not open');
  }
};

/**
 * Sends multiple packets.
 *
 * @param {Array} packets
 * @api private
 */

Transport.prototype.sendMany = function (packets) {
  if ('open' == this.readyState) {
    this.writeBuffer.push.apply(this.writeBuffer, packets);
    this.flush();
  } else {
    throw new Error('Transport not open');
  }
}

/**
 * Flushes the send buffer.
 *
 * @api private
 */

Transport.prototype.flush = function () {
  if (this.flushing || !this.writeBuffer.length) return;

  var offset = this.writeBuffer.length
    , self = this

  this.flushing = true;
  // debug: flushing transport buffer with %d items, this.writeBuffer.length
  this.write(this.writeBuffer, function () {
    self.writeBuffer.splice(0, offset);
    self.flushing = false;
    self.emit('flush');

    if (self.writeBuffer.length) {
      // debug: flushing again
      self.flush();
    } else {
      // debug: flush drained
      self.emit('drain');
    }
  });
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.flush();
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
