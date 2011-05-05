
/**
 * Module dependencies.
 */

const EventEmitter = process.EventEmitter;

/**
 * Exports the constructor.
 */

exports = module.exports = SocketNamespace;

/**
 * Constructor.
 *
 * @api public.
 */

function SocketNamespace (mgr, nsp) {
  this.manager = mgr;
  this.nsp = nsp || '';
  this.flags = {};
};

/**
 * Inherits from EventEmitter.
 */

SocketNamespace.prototype.__proto__ = EventEmitter.prototype;

/**
 * JSON message flag.
 *
 * @api public
 */

SocketNamespace.prototype.__defineGetter__('json', function () {
  this.flags.json = true;
  return this;
});

/**
 * Volatile message flag.
 *
 * @api public
 */

SocketNamespace.prototype.__defineGetter__('volatile', function () {
  this.flags.volatile = true;
  return this;
});

/**
 * Writes to everyone.
 *
 * @api public
 */

SocketNamespace.prototype.send = function () {
  this.flags = {};
};
