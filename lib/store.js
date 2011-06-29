
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Expose the constructor.
 */

exports = module.exports = Store;

/**
 * Module dependencies.
 */

var EventEmitter = process.EventEmitter;

/**
 * Store interface
 *
 * @api public
 */

function Store (options) {
  this.options = options;
  this.clients = {};
};

/**
 * Inherit from EventEmitter.
 */

Store.prototype.__proto__ = EventEmitter.prototype;

/**
 * Initializes a client store
 *
 * @param {String} id
 * @api public
 */

Store.prototype.client = function (id) {
  if (!this.clients[id]) {
    this.clients[id] = new (this.constructor.Client)(this, id);
    this.log.debug('initializing client store for', id);
  }

  return this.clients[id];
};

/**
 * Destroys a client
 *
 * @api private
 */

Store.prototype.destroy = function (id) {
  this.clientsMap[id].destroy();
  delete this.clientsMap[id];
};

/**
 * Client.
 *
 * @api public
 */

Store.Client = function (store, id) {
  this.store = store;
  this.id = id;
};
