
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
 * @api public
 */

Emitter.prototype.removeAllListeners = function(){
  this._callbacks = {};
};
