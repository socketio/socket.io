/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var util = require('./util')
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
  this.flags = {};
  this.packets = 0;
  this.disconnected = false;
  this.acks = {};

  if (readable) {
    var self = this;

    this.store.once('disconnect:' + id, function (reason) {
      self.onDisconnect(reason);
    });
  }
}

/**
 * Inherits from EventEmitter.
 */

Socket.prototype.__proto__ = EventEmitter.prototype;

/**
 * Accessor shortcut for the store.
 *
 * @api private
 */

Socket.prototype.__defineGetter__('store', function store () {
  return this.manager.store;
});

/**
 * Accessor shortcut for the logger.
 *
 * @api private
 */

Socket.prototype.__defineGetter__('log', function log () {
  return this.manager.log;
});

/**
 * JSON message flag.
 *
 * @api public
 */

Socket.prototype.__defineGetter__('json', function json () {
  this.flags.json = true;
  return this;
});

/**
 * Volatile message flag.
 *
 * @api public
 */

Socket.prototype.__defineGetter__('volatile', function volatile () {
  this.flags.volatile = true;
  return this;
});

/**
 * Triggered on disconnect
 *
 * @api private
 */

Socket.prototype.onDisconnect = function onDisconnect (reason) {
  if (!this.disconnected) {
    this.emit('disconnect', reason);
    this.disconnected = true;
  }
};

/**
 * Transmits a packet.
 *
 * @api private
 */

Socket.prototype.packet = function packet (msg, volatile) {
  if (volatile) {
    this.store.publish('volatile:' + this.id, msg);
  } else {
    this.store.client(this.id).publish(msg);
  }

  return this;
};

/**
 * Stores data for the client.
 *
 * @api public
 */

Socket.prototype.set = function set (key, value, fn) {
  this.store.client(this.id).set(key, value, fn);
  return this;
};

/**
 * Retrieves data for the client
 *
 * @api public
 */

Socket.prototype.get = function get (key, fn) {
  this.store.client(this.id).get(key, fn);
  return this;
};

/**
 * Kicks client
 *
 * @api public
 */

Socket.prototype.disconnect = function disconnect () {
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

Socket.prototype.send = function send (data, fn) {
  var packet = {
      type: this.flags.json ? 'json' : 'message'
    , data: data
  };

  if (fn) {
    packet.id = ++this.packets;
    packet.ack = fn.length ? 'data' : true;
    this.acks[packet.id] = fn;
  }

  this.packet(packet, this.flags.volatile);
  this.flags = {};

  return this;
};

/**
 * Emit override for custom events.
 *
 * @api public
 */

Socket.prototype.emit = function emit (ev) {
  if (events[ev]) {
    return EventEmitter.prototype.emit.apply(this, arguments);
  }

  var args = util.toArray(arguments).slice(1)
    , lastArg = args[args.length - 1];
  
  // prepare packet to send
  var packet = {
      type: 'event'
    , args: args
  };

  if ('function' == typeof lastArg) {
    packet.id = ++this.packets;
    packet.ack = lastArg.length ? 'data' : true;
    this.acks[packet.id] = fn;
  }

  this.packet(packet, this.flags.volatile);
  this.flags = {};

  return this;
};
