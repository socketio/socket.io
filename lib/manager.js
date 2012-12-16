
/**
 * Module dependencies.
 */

var url = require('./url')
  , eio = require('./engine')
  , Socket = require('./socket')
  , Emitter = require('./emitter')
  , parser = require('socket.io-parser')
  , on = require('./on')
  , debug = require('debug')('socket.io-client:manager')
  , object, bind;

/**
 * Module exports
 */

module.exports = Manager;

/**
 * `Manager` constructor.
 *
 * @param {Socket|Object|String} engine instance or engine uri/opts
 * @param {Object} options
 * @api public
 */

function Manager(socket, opts){
  if (!(this instanceof Manager)) return new Manager(socket, opts);
  opts = opts || {};
  opts.path = opts.path || '/socket.io';
  this.nsps = {};
  this.subs = [];
  this.reconnection(opts.reconnection);
  this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
  this.reconnectionDelay(opts.reconnectionDelay || 1000);
  this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
  this.timeout(null == opts.timeout ? 10000 : opts.timeout);
  this.readyState = 'closed';
  if (!socket || !socket.write) socket = eio(socket, opts);
  this.engine = socket;
  this.open();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Manager.prototype);

/**
 * Sets the `reconnection` config.
 *
 * @param {Boolean} true/false if it should automatically reconnect
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnection = function(v){
  if (!arguments.length) return this._reconnection;
  this._reconnection = !!v;
  return this;
};

/**
 * Sets the reconnection attempts config.
 *
 * @param {Number} max reconnection attempts before giving up
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionAttempts = function(v){
  if (!arguments.length) return this._reconnectionAttempts;
  this._reconnectionAttempts = v;
  return this;
};

/**
 * Sets the delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelay = function(v){
  if (!arguments.length) return this._reconnectionDelay;
  this._reconnectionDelay = v;
  return this;
};

/**
 * Sets the maximum delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelayMax = function(v){
  if (!arguments.length) return this._reconnectionDelayMax;
  this._reconnectionDelayMax = v;
  return this;
};

/**
 * Sets the connection timeout. `false` to disable
 *
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.timeout = function(v){
  if (!arguments.length) return this._timeout;
  this._timeout = v;
  return this;
};

/**
 * Sets the current transport `socket`.
 *
 * @param {Socket} socket
 * @api public
 */

Manager.prototype.open =
Manager.prototype.connect = function(socket, fn){
  var self = this;
  var timerSub;

  this.readyState = 'opening';

  // emit `open`
  var openSub = socket.on('open', bind(this, 'onopen'));

  // emit `connect_error`
  var errorSub = socket.on('error', function(data){
    self.cleanup();
    self.emit('connect_error', data);
    if (fn) {
      var err = new Error('Connection error');
      err.data = data;
      fn(err);
    }
  });

  // emit `connect_timeout`
  if (false !== this._timeout) {
    var timeout = this._timeout;
    debug('connect attempt will timeout after %d', timeout);

    // set timer
    var timer = setTimeout(function(){
      debug('connect attempt timed out after %d', timeout);
      openSub.destroy();
      errorSub.destroy();
      socket.close();
      socket.emit('error', 'timeout');
      self.emit('connect_timeout', timeout);
    }, timeout);

    // create handle
    timerSub = {
      destroy: function(){
        clearTimeout(timer);
      }
    };

    this.subs.push(timerSub);
  }

  this.subs.push(openSub);
  this.subs.push(errorSub);
};

/**
 * Called upon transport open.
 *
 * @api private
 */

Manager.prototype.onopen = function(){
  this.readyState = 'open';
  this.cleanup();
  this.emit('open');
  this.subs.push(this.socket.on('data', bind(this, 'ondata')));
  this.subs.push(this.socket.on('error', bind(this, 'onerror')));
  this.subs.push(this.socket.on('close', bind(this, 'onclose')));
};

/**
 * Called with data.
 *
 * @api private
 */

Manager.prototype.ondata = function(data){
  this.emit('packet', parser.decode(data));
};

/**
 * Called upon socket error.
 *
 * @api private
 */

Manager.prototype.onerror = function(err){
  this.emit('error', err);
};

/**
 * Creates a new socket for the given `nsp`.
 *
 * @return {Socket}
 * @api public
 */

Manager.prototype.socket = function(nsp){
  var socket = this.nsps[nsp];
  if (!socket) {
    socket = new Socket(this, nsp);
    this.nsps[nsp] = socket;
  }
  return socket;
};

/**
 * Called upon a socket close.
 *
 * @param {Socket} socket
 */

Manager.prototype.destroy = function(socket){
  delete this.nsps[socket.nsp];
  if (!object.length(this.nsps)) {
    this.close();
  }
};

/**
 * Clean up transport subscriptions.
 *
 * @api private
 */

Manager.prototype.cleanup = function(){
  for (var i = 0; i < this.subs.length; i++) {
    this.subs[i].destroy();
  }
  this.subs = [];
};

/**
 * Close the current socket.
 *
 * @api private
 */

Manager.prototype.close =
Manager.prototype.disconnect = function(){
  this.skipReconnect = true;
  this.cleanup();
  this.socket.close();
};

/**
 * Called upon engine close.
 *
 * @api private
 */

Manager.prototype.onclose = function(){
  this.cleanup();
  if (!this.skipReconnect) {
    var self = this;
    this.reconnect();
  }
};

/**
 * Attempt a reconnection.
 *
 * @api private
 */

Manager.prototype.reconnect = function(){
  var self = this;
  this.attempts++;

  if (this.attempts > this._reconnectionAttempts) {
    this.emit('reconnect_failed');
    this.reconnecting = false;
  } else {
    var delay = this.attempts * this._reconnectionDelay;
    delay = Math.min(delay, this._reconnectionDelayMax);
    debug('will wait %d before reconnect attempt', delay);

    this.reconnecting = true;
    var timer = setTimeout(function(){
      debug('attemptign reconnect');
      self.open(function(err){
        if (err) {
          debug('reconnect attempt error');
          self.reconnect();
          return self.emit('reconnect_error', err.data);
        } else {
          debug('reconnect success');
          self.onreconnect();
        }
      });
    }, delay);

    this.subs.push({
      destroy: function(){
        clearTimeout(timer);
      }
    });
  }
};

/**
 * Called upon successful reconnect.
 *
 * @api private
 */

Manager.prototype.onreconnect = function(){
  var attempt = this.attempts;
  this.attempts = 0;
  this.reconnecting = false;
  this.emit('reconnect', attempt);
};

/**
 * Get bind component for node and browser.
 */

try {
  bind = require('bind');
  object = require('object');
} catch(e){
  bind = require('bind-component');
  object = require('object-component');
}
