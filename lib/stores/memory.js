
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var crypto = require('crypto')
  , Store = require('../store');

/**
 * Exports the constructor.
 */

exports = module.exports = Memory;
Memory.Client = Client;

/**
 * Memory store
 *
 * @api public
 */

function Memory (opts) {
  Store.call(this, opts);
};

/**
 * Inherits from Store.
 */

Memory.prototype.__proto__ = Store.prototype;

/**
 * Publishes a message.
 *
 * @api private
 */

Memory.prototype.publish = function () { };

/**
 * Subscribes to a channel
 *
 * @api private
 */

Memory.prototype.subscribe = function () { };

/**
 * Unsubscribes
 *
 * @api private
 */

Memory.prototype.unsubscribe = function () { };

/**
 * Client constructor
 *
 * @api private
 */

function Client () {
  Store.Client.apply(this, arguments);
  this.data = {};
};

/**
 * Inherits from Store.Client
 */

Client.prototype.__proto__ = Store.Client;

/**
 * Gets a key
 *
 * @api private
 */

Client.prototype.get = function (key, fn) {
  fn(null, this.data[key]);
};

/**
 * Sets a key
 *
 * @api private
 */

Client.prototype.set = function (key, value) {
  this.data[key] = value;
};

/**
 * Destroys the client.
 *
 * @api private
 */

Client.prototype.destroy = function () {
  delete this.data;
};

