
/**
 * Module dependencies.
 */

var Emitter;

try {
  Emitter = require('emitter');
} catch(e){
  Emitter = require('emitter-component');
}

/**
 * Module exports.
 */

module.exports = Emitter;

/**
 * Override `on` to return a handle.
 *
 * @return {Object} handle
 * @api private
 */

var on = Emitter.prototype.on;
Emitter.prototype.on = function(ev, fn){
  on.call(this, ev, fn);
  var self = this;
  return {
    destroy: function(){
      self.off(ev, fn);
    }
  };
};

/**
 * Node-compatible `EventEmitter#removeListener`
 *
 * @api public
 */

Emitter.prototype.removeListener = function(event, fn){
  return this.off(event, fn);
};

/**
 * Node-compatible `EventEmitter#removeAllListeners`
 *
 * @return {Emitter} self
 * @api public
 */

Emitter.prototype.removeAllListeners = function(){
  this._callbacks = {};
  return this;
};
