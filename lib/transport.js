
/**
 * Module dependencies.
 */

var util = require('./util')
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
  this.options = opts;
  this.readyState = '';
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

Transport.prototype.error = function (code) {
  var err = new Error('transport error');
  err.code = code;
  this.emit('error', code);
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
 * Sends a message.
 *
 * @param {String} data
 * @api public
 */

Transport.prototype.send = function (data) {
  if (this.readyState != 'open') {
    this.error('not open');
  } else {
    if (this.buffer) {
      if (!this.writeBuffer) {
        this.writeBuffer = [];
      }

      this.writeBuffer.push(data);
      return this;
    }

    var self = this;
    this.buffer = true;
    this.write(data, function () {
      self.flush();
    });
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
  this.onMessage(parser.decodePacket(data));
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
