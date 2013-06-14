
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
  , assert = require('assert');

/**
 * Exports the constructor.
 */

exports = module.exports = Redis;
Redis.Client = Client;

/**
 * Redis store.
 * Options:
 *     - nodeId (fn) gets an id that uniquely identifies this node
 *     - redis (fn) redis constructor, defaults to redis
 *     - redisPub (object) options to pass to the pub redis client
 *     - redisSub (object) options to pass to the sub redis client
 *     - redisClient (object) options to pass to the general redis client
 *     - pack (fn) custom packing, defaults to JSON or msgpack if installed
 *     - unpack (fn) custom packing, defaults to JSON or msgpack if installed
 *
 * @api public
 */

function Redis (opts) {
  opts = opts || {};

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

  var redis = opts.redis || require('redis')
    , RedisClient = redis.RedisClient;

  // initialize a pubsub client and a regular client
  if (opts.redisPub instanceof RedisClient) {
    this.pub = opts.redisPub;
  } else {
    opts.redisPub || (opts.redisPub = {});
    this.pub = redis.createClient(opts.redisPub.port, opts.redisPub.host, opts.redisPub);
  }
  if (opts.redisSub instanceof RedisClient) {
    this.sub = opts.redisSub;
  } else {
    opts.redisSub || (opts.redisSub = {});
    this.sub = redis.createClient(opts.redisSub.port, opts.redisSub.host, opts.redisSub);
  }
  if (opts.redisClient instanceof RedisClient) {
    this.cmd = opts.redisClient;
  } else {
    opts.redisClient || (opts.redisClient = {});
    this.cmd = redis.createClient(opts.redisClient.port, opts.redisClient.host, opts.redisClient);
  }

  Store.call(this, opts);

  this.sub.setMaxListeners(0);
  this.setMaxListeners(0);

  // initialize subscribe, unsubscribe, message event.
  var self = this;

  this.subscribeRepository = {};
  this.unsubscribeRepository = {};
  this.messageConsumers = {};

  this.sub.on('subscribe', function (ch) {
    var sub = self.subscribeRepository[ch];

    if (typeof sub !== 'undefined') {
      delete self.subscribeRepository[ch];

      if (typeof sub.consumer === 'function') {
        self.messageConsumers[ch] = sub.consumer;
      }

      if (typeof sub.fn === 'function') {
        sub.fn();
      }
    }
  });

  this.sub.on('unsubscribe', function (ch) {
    delete self.messageConsumers[ch];

    var fn = self.unsubscribeRepository[ch];

    delete self.unsubscribeRepository[ch];

    if (typeof fn === 'function') {
      fn();
    }
  });

  this.sub.on('message', function (ch, msg) {
    msg = self.unpack(msg);

    if (self.nodeId != msg.nodeId && typeof self.messageConsumers[ch] === 'function') {
      self.messageConsumers[ch].apply(null, msg.args);
    }
  });
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
  var args = Array.prototype.slice.call(arguments, 1);
  this.pub.publish(name, this.pack({ nodeId: this.nodeId, args: args }));
  this.emit.apply(this, ['publish', name].concat(args));
};

/**
 * Subscribes to a channel
 *
 * @api private
 */

Redis.prototype.subscribe = function (name, consumer, fn) {
  this.subscribeRepository[name] = {
    consumer: consumer,
    fn: fn
  };

  this.sub.subscribe(name);
};

/**
 * Unsubscribes
 *
 * @api private
 */

Redis.prototype.unsubscribe = function (name, fn) {
  this.unsubscribeRepository[name] = fn;

  this.sub.unsubscribe(name);
};

/**
 * Destroys the store
 *
 * @api public
 */

Redis.prototype.destroy = function () {
  Store.prototype.destroy.call(this);

  this.pub.end();
  this.sub.end();
  this.cmd.end();
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

Client.prototype.get = function (key, fn) {
  this.store.cmd.hget(this.id, key, fn);
  return this;
};

/**
 * Redis hash set
 *
 * @api private
 */

Client.prototype.set = function (key, value, fn) {
  this.store.cmd.hset(this.id, key, value, fn);
  return this;
};

/**
 * Redis hash del
 *
 * @api private
 */

Client.prototype.del = function (key, fn) {
  this.store.cmd.hdel(this.id, key, fn);
  return this;
};

/**
 * Redis hash has
 *
 * @api private
 */

Client.prototype.has = function (key, fn) {
  this.store.cmd.hexists(this.id, key, function (err, has) {
    if (err) return fn(err);
    fn(null, !!has);
  });
  return this;
};

/**
 * Destroys client
 *
 * @param {Number} number of seconds to expire data
 * @api private
 */

Client.prototype.destroy = function (expiration) {
  if ('number' != typeof expiration) {
    this.store.cmd.del(this.id);
  } else {
    this.store.cmd.expire(this.id, expiration);
  }

  return this;
};
