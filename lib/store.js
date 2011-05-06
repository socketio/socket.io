
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var EventEmitter = process.EventEmitter;

/**
 * Expose the constructor.
 */

exports = module.exports = Store;

/**
 * Store interface
 *
 * @api public
 */

function Store () {};

/**
 * Inherits from EventEmitter
 */

Store.prototype.__proto__ = EventEmitter.prototype;

/**
 * Log accessor.
 *
 * @api public
 */

Store.prototype.__defineGetter__('log', function () {
  return this.manager.log;
});

/**
 * Client.
 *
 * @api public
 */

Store.Client = function (store, id) {
  this.store = store;
  this.id = id;
  this.buffer = [];
  this.dict = {};
};
