
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
};

/**
 * ReadyStates -> event map.
 */

var readyStates = {
    0: 'disconnect'
  , 1: 'connect'
  , 2: 'open'
  , 3: 'close'
};

/**
 * Socket constructor.
 *
 * @api public
 */

function Socket (manager, id, nsp, readonly) {
  this.id = id;
  this.namespace = nsp;
  this.manager = manager;
  this.flags = {};
  this.rs = 1;
  this.packets = 0;

  if (!readonly)
    this.store.on('message:' + id, function () {
      
    });
};

/**
 * Inherits from EventEmitter.
 */

Socket.prototype.__proto__ = EventEmitter.prototype;

/**
 * readyState getter.
 *
 * @api private
 */

Socket.prototype.__defineGetter__('readyState', function (st) {
  return this.rs;
});

/**
 * readyState setter.
 *
 * @api private
 */

Socket.prototype.__defineSetter__('readyState', function (state) {
  this.rs = state;
  this.emit('readyState', state);
  this.emit(readyStates[state]);
});

/**
 * Accessor shortcut for the store.
 *
 * @api private
 */

Socket.prototype.__defineGetter__('store', function () {
  return this.manager.store;
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
 * Transmits a packet.
 *
 * @api private
 */

Socket.prototype.packet = function (msg, volatile) {
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
  this.packet({ type: 'disconnect' });
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
    packet.id = ++this.packets;
    packet.ack = fn.length ? 'data' : true;
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

Socket.prototype.emit = function (ev) {
  if (events.ev)
    return EventEmitter.protype.emit.apply(this, arguments);

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
  }

  this.packet(packet, this.flags.volatile);
  this.flags = {};
  return this;
};
