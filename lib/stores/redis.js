/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var crypto = require('crypto')
  , Store = require('../store')
  , assert = require('assert')
  , redis = require('redis');

/**
 * Exports the constructor.
 */

exports = module.exports = Redis;
Redis.Client = Client;

/**
 * Redis store.
 * Options:
 *     - nodeId (fn) gets an id that uniquely identifies this node
 *     - redisPubsub (object) options to pass to the pubsub redis client
 *     - redisClient (object) options to pass to the general redis client
 *     - pack (fn) custom packing, defaults to JSON or msgpack if installed
 *     - unpack (fn) custom packing, defaults to JSON or msgpack if installed
 *
 * @api public
 */

function Redis (opts) {
  // node id to uniquely identify this node
  var nodeId = opts.nodeId || function () {
    // by default, we generate a random id 
    return Math.abs(Math.random() * Math.random() * Date.now() | 0);
  };

  this.nodeId = nodeId();

  // packing / unpacking mechanism
  if (opts.pack) {
    this.pack = opts.pack;
    this.unpack = opts.unpack;
  } else {
    try {
      var msgpack = require('msgpack');
      this.pack = msgpack.pack;
      this.unpack = msgpack.unpack;
    } catch (e) {
      this.pack = JSON.stringify;
      this.unpack = JSON.parse;
    }
  }

  // initialize a pubsub client and a regular client
  this.pubsub = redis.createClient(opts.redisPubsub);
  this.client = redis.createClient(opts.redisClient);

  Store.call(this, opts);
};

/**
 * Inherits from Store.
 */

Redis.prototype.__proto__ = Store.prototype;

/**
 * Publishes a message.
 *
 * @api private
 */

Redis.prototype.publish = function (name) {
  var args = Array.prototype.slice.call(1);
  this.pubsub.publish(name, this.pack({ nodeId: this.nodeId, args: args }));
  this.emit.apply(this, ['publish', name].concat(args));
};

/**
 * Subscribes to a channel
 *
 * @api private
 */

Redis.prototype.subscribe = function (name, fn, once) {
  this.pubsub.subscribe(name);

  if (fn || once) {
    var self = this;

    self.pubsub.on('subscribe', function subscribe (ch) {
      if (name == ch) {
        function message (ch, msg) {
          if (name == ch) {
            msg = this.unpack(msg);

            // we check that the message consumed wasnt emitted by this node
            if (self.nodeId != msg.nodeId) {
              fn.apply(null, msg.args);

              if (once) {
                self.pubsub.removeListener('message', message);
              }
            }
          }
        };

        self.pubsub.on('message', message);

        if (!once) {
          self.on('unsubscribe', function unsubscribe (ch) {
            if (name == ch) {
              self.pubsub.removeListener('message', message);
              self.removeEvent('unsubscribe', unsubscribe);
            }
          });
        }

        self.pubsub.removeListener('subscribe', subscribe);
      }
    });
  }

  this.emit('subscribe', name, fn, once);
};

/**
 * Unsubscribes
 *
 * @api private
 */

Redis.prototype.unsubscribe = function (name, fn) {
  this.pubsub.unsubscribe(name);

  if (fn) {
    var client = this.pubsub;

    client.on('unsubscribe', function unsubscribe (ch) {
      if (name == ch) {
        fn();
        client.removeListener('unsubscribe', unsubscribe);
      }
    });
  }

  this.emit('unsubscribe', name, fn);
};

/**
 * Client constructor
 *
 * @api private
 */

function Client (store, id) {
  Store.Client.call(this, store, id);
};

/**
 * Inherits from Store.Client
 */

Client.prototype.__proto__ = Store.Client;

/**
 * Redis hash get
 *
 * @api private
 */

Client.prototype.get = function (key) {
  this.store.client.hget(this.id, key, fn);
};

/**
 * Redis hash set
 *
 * @api private
 */

Client.prototype.set = function (key, value) {
  this.store.client.hset(this.id, key, value);
};
