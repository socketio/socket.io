/**
 * Module dependencies.
 */

var Socket = require('./socket')
  , EventEmitter = process.EventEmitter;

/**
 * Exports the constructor.
 */

exports = module.exports = SocketNamespace;

/**
 * Constructor.
 *
 * @api public.
 */

function SocketNamespace (mgr, name) {
  this.manager = mgr;
  this.name = name || '';
  this.sockets = {};
  this.flags = {};
}

/**
 * Inherits from EventEmitter.
 */

SocketNamespace.prototype.__proto__ = EventEmitter.prototype;

/**
 * Access logger interface.
 *
 * @api public
 */

SocketNamespace.prototype.__defineGetter__('log', function log () {
  return this.manager.log;
});

/**
 * JSON message flag.
 *
 * @api public
 */

SocketNamespace.prototype.__defineGetter__('json', function json () {
  this.flags.json = true;
  return this;
});

/**
 * Volatile message flag.
 *
 * @api public
 */

SocketNamespace.prototype.__defineGetter__('volatile', function volatile () {
  this.flags.volatile = true;
  return this;
});

/**
 * Writes to everyone.
 *
 * @api public
 */

SocketNamespace.prototype.send = function send () {
  this.flags = {};
};

/**
 * Emits to everyone (override)
 *
 * @api private
 */

SocketNamespace.prototype.emit = function emit (name) {
  if (name == 'connection' || name == 'newListener') {
    return EventEmitter.prototype.emit.apply(this, arguments);
  }

  this.flags = {};
};

/**
 * Retrieves or creates a write-only socket for a client, unless specified.
 *
 * @param {Boolean} whether the socket will be readable when initialized
 * @api private
 */

SocketNamespace.prototype.socket = function socket (sid, readable) {
  if (!this.sockets[sid]) {
    this.sockets[sid] = new Socket(this.manager, sid, this, readable);
    if (this.name === '') {
      this.emit('connection', this.sockets[sid]);
    }
  }

  return this.sockets[sid];
};

/**
 * Handles a packet.
 *
 * @api private
 */

SocketNamespace.prototype.handlePacket = function handlePacket (sessid, packet) {
  var socket = this.socket(sessid);

  switch (packet.type) {
    case 'connect':
      this.emit('connection', this.sockets[sessid]);
      break;

    case 'ack':
      if (socket.acks[packet.ackId]) {
        socket.acks[packet.ackId].apply(socket, packet.args);
      } else {
        this.log.info('unknown ack packet');
      }
      break;

    case 'event':
      socket.emit.apply(socket, [packet.name].concat(packet.args));
      break;

    case 'disconnect':
      socket.emit('disconnect');
      break;

    case 'json':
    case 'message':
      socket.emit('message', packet.data);
      break;
  }
};
