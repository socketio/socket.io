
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var parser = require('./parser')
  , util = require('./util')
  , EventEmitter = process.EventEmitter;

/**
 * Export the constructor.
 */

exports = module.exports = Socket;

/**
 * Reserved event names.
 */

var events = {
    message: 1
  , connect: 1
  , disconnect: 1
  , open: 1
  , close: 1
  , error: 1
  , retry: 1
  , reconnect: 1
  , newListener: 1
};

/**
 * Socket constructor.
 *
 * @param {Manager} manager instance
 * @param {String} session id
 * @param {Namespace} namespace the socket belongs to
 * @param {Boolean} whether the 
 * @api public
 */

function Socket (manager, id, nsp, readable) {
  this.id = id;
  this.namespace = nsp;
  this.manager = manager;
  this.disconnected = false;
  this.ackPackets = 0;
  this.acks = {};
  this.setFlags();

  if (readable) {
    var self = this;

    this.store.once('disconnect:' + id, function (reason) {
      self.onDisconnect(reason);
    });
  }
};

/**
 * Inherits from EventEmitter.
 */

Socket.prototype.__proto__ = EventEmitter.prototype;

/**
 * Accessor shortcut for the store.
 *
 * @api private
 */

Socket.prototype.__defineGetter__('store', function () {
  return this.manager.store;
});

/**
 * Accessor shortcut for the logger.
 *
 * @api private
 */

Socket.prototype.__defineGetter__('log', function () {
  return this.manager.log;
});

/**
 * JSON message flag.
 *
 * @api public
 */

Socket.prototype.__defineGetter__('json', function () {
  this.flags.json = true;
  return this;
});

/**
 * Volatile message flag.
 *
 * @api public
 */

Socket.prototype.__defineGetter__('volatile', function () {
  this.flags.volatile = true;
  return this;
});

/**
 * Broadcast message flag.
 *
 * @api public
 */

Socket.prototype.__defineGetter__('broadcast', function () {
  this.flags.broadcast = true;
  return this;
});

/**
 * Overrides the room to broadcast messages to (flag)
 *
 * @api public
 */

Socket.prototype.to = function (room) {
  this.flags.room = room;
  return this;
};

/**
 * Resets flags
 *
 * @api private
 */

Socket.prototype.setFlags = function () {
  this.flags = {
      endpoint: this.namespace.name
    , room: ''
  };
  return this;
};

/**
 * Triggered on disconnect
 *
 * @api private
 */

Socket.prototype.onDisconnect = function (reason) {
  if (!this.disconnected) {
    this.emit('disconnect', reason);
    this.disconnected = true;
  }
};

/**
 * Joins a user to a room.
 *
 * @api public
 */

Socket.prototype.join = function (name, fn) {
  var nsp = this.namespace.name;
  this.store.join(this.id, (nsp === '' ? '' : (nsp + '/')) + name, fn);
  return this;
};

/**
 * Joins a user to a room.
 *
 * @api public
 */

Socket.prototype.leave = function (name, fn) {
  var nsp = this.namespace.name;
  this.store.leave(this.id, (nsp === '' ? '' : (nsp + '/')) + name, fn);
  return this;
};

/**
 * Transmits a packet.
 *
 * @api private
 */

Socket.prototype.packet = function (packet) {
  if (this.flags.broadcast) {
    this.log.debug('broadcasting packet');
    this.namespace.in(this.flags.room).except(this.id).packet(packet);
  } else {
    packet.endpoint = this.flags.endpoint;
    packet = parser.encodePacket(packet);

    if (this.flags.volatile) {
      this.store.publish('volatile:' + this.id, packet);
    } else {
      this.store.client(this.id).publish(packet);
    }
  }

  this.setFlags();

  return this;
};

/**
 * Stores data for the client.
 *
 * @api public
 */

Socket.prototype.set = function (key, value, fn) {
  this.store.client(this.id).set(key, value, fn);
  return this;
};

/**
 * Retrieves data for the client
 *
 * @api public
 */

Socket.prototype.get = function (key, fn) {
  this.store.client(this.id).get(key, fn);
  return this;
};

/**
 * Kicks client
 *
 * @api public
 */

Socket.prototype.disconnect = function () {
  if (!this.disconnected) {
    this.log.info('booting client');
    this.store.disconnect(this.id, true);
  }

  return this;
};

/**
 * Send a message.
 *
 * @api public
 */

Socket.prototype.send = function (data, fn) {
  var packet = {
      type: this.flags.json ? 'json' : 'message'
    , data: data
  };

  if (fn) {
    packet.id = ++this.ackPackets;
    packet.ack = true;
    this.acks[packet.id] = fn;
  }

  return this.packet(packet);
};

/**
 * Original emit function.
 *
 * @api private
 */

Socket.prototype.$emit = EventEmitter.prototype.emit;

/**
 * Emit override for custom events.
 *
 * @api public
 */

Socket.prototype.emit = function (ev) {
  if (events[ev]) {
    return this.$emit.apply(this, arguments);
  }

  var args = util.toArray(arguments).slice(1)
    , lastArg = args[args.length - 1]
    , packet = {
          type: 'event'
        , name: ev
      };

  if ('function' == typeof lastArg) {
    packet.id = ++this.ackPackets;
    packet.ack = lastArg.length ? 'data' : true;
    this.acks[packet.id] = lastArg;
    args = args.slice(0, args.length - 1);
  }

  packet.args = args;

  return this.packet(packet);
};
