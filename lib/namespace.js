
/**
 * Module dependencies.
 */

var Socket = require('./socket')
  , EventEmitter = process.EventEmitter
  , parser = require('./parser')
  , util = require('./util');

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
  this.setFlags();
};

/**
 * Inherits from EventEmitter.
 */

SocketNamespace.prototype.__proto__ = EventEmitter.prototype;

/**
 * Access logger interface.
 *
 * @api public
 */

SocketNamespace.prototype.__defineGetter__('log', function () {
  return this.manager.log;
});

/**
 * Access store.
 *
 * @api public
 */

SocketNamespace.prototype.__defineGetter__('store', function () {
  return this.manager.store;
});

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
 * Overrides the room to relay messages to (flag)
 *
 * @api public
 */

SocketNamespace.prototype.in = function (room) {
  this.flags.endpoint = (this.name === '' ? '' : (this.name + '/')) + room;
  return this;
};

/**
 * Adds a session id we should prevent relaying messages to (flag)
 *
 * @api public
 */

SocketNamespace.prototype.except = function (id) {
  this.flags.exceptions.push(id);
  return this;
};

/**
 * Sets the default flags.
 *
 * @api private
 */

SocketNamespace.prototype.setFlags = function () {
  this.flags = {
      endpoint: this.name
    , exceptions: []
  };
  return this;
};

/**
 * Sends out a packet
 *
 * @api private
 */

SocketNamespace.prototype.packet = function (packet) {
  packet.endpoint = this.name;

  var store = this.store
    , log = this.log
    , volatile = this.flags.volatile
    , exceptions = this.flags.exceptions
    , packet = parser.encodePacket(packet);

  store.clients(this.flags.endpoint, function (clients) {
    clients.forEach(function (id) {
      if (~exceptions.indexOf(id)) {
        log.debug('ignoring packet to ', id);
        return;
      }

      if (volatile) {
        store.publish('volatile:' + id, packet);
      } else {
        store.client(id).publish(packet);
      }
    });
  });

  this.setFlags();

  return this;
};

/**
 * Sends to everyone.
 *
 * @api public
 */

SocketNamespace.prototype.send = function (data) {
  return this.packet({
      type: this.flags.json ? 'json' : 'message'
    , data: data
  });
};

/**
 * Emits to everyone (override)
 *
 * @api private
 */

SocketNamespace.prototype.emit = function (name) {
  if (name == 'connection' || name == 'newListener') {
    return EventEmitter.prototype.emit.apply(this, arguments);
  }

  return this.packet({
      type: 'event'
    , name: name
    , args: util.toArray(arguments).slice(1)
  });
};

/**
 * Retrieves or creates a write-only socket for a client, unless specified.
 *
 * @param {Boolean} whether the socket will be readable when initialized
 * @api private
 */

SocketNamespace.prototype.socket = function (sid, readable) {
  if (!this.sockets[sid]) {
    this.sockets[sid] = new Socket(this.manager, sid, this, readable);
  }

  return this.sockets[sid];
};

/**
 * Handles a packet.
 *
 * @api private
 */

SocketNamespace.prototype.handlePacket = function (sessid, packet) {
  var socket = this.socket(sessid)
    , dataAck = packet.ack == 'data'
    , self = this;

  function ack () {
    self.log.debug('sending data ack packet');
    socket.packet({
        type: 'ack'
      , args: util.toArray(arguments)
      , ackId: packet.id
    });
  };

  switch (packet.type) {
    case 'connect':
      this.store.join(sessid, this.name, function () {
        // packet echo
        socket.packet({ type: 'connect' });
        self.emit('connection', socket);
      });
      break;

    case 'ack':
      if (socket.acks[packet.ackId]) {
        socket.acks[packet.ackId].apply(socket, packet.args);
      } else {
        this.log.info('unknown ack packet');
      }
      break;

    case 'event':
      var params = [packet.name].concat(packet.args);

      if (dataAck)
        params.push(ack);

      socket.$emit.apply(socket, params);
      break;

    case 'disconnect':
      socket.emit('disconnect');
      break;

    case 'json':
    case 'message':
      var params = ['message', packet.data];

      if (dataAck)
        params.push(ack);

      socket.emit.apply(socket, params);
  };
};
