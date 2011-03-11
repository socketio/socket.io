/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
  var io = this.io,
  /**
   * Is the page loaded yet
   *
   * @type {Boolean}
   * @api private
   */
  pageLoaded = false;
  
  /**
   * @namespace
   */
  io.util = {
    /**
     * Executes the given function when the page is loaded.
     *
     * @param {Function} fn
     * @api public
     */
    load: function(fn){
      if (/loaded|complete/.test(document.readyState) || pageLoaded) return fn();
      if ('attachEvent' in window){
        window.attachEvent('onload', fn);
      } else {
        window.addEventListener('load', fn, false);
      }
    },
    
    /**
     * Inherit the prototype methods from one constructor into another.
     *
     * @param {Constructor} ctor The constructor that needs to inherit the methods.
     * @param {Constructor} superCtor The constructor to inherit from.
     * @api public
     */
    inherit: function(ctor, superCtor){
      // no support for `instanceof` for now
      for (var i in superCtor.prototype){
        ctor.prototype[i] = superCtor.prototype[i];
      }
    },
    
    /**
     * Finds the index of item in a given Array.
     *
     * @param {Array} arr The array
     * @param item The item that we need to find
     * @param {Integer} from Starting point
     * @api public
     */
    indexOf: function(arr, item, from){
      for (var l = arr.length, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
        if (arr[i] === item) return i;
      }
      return -1;
    },
    
    /**
     * Checks if the given object is an Array.
     *
     * @param obj
     * @api public
     */
    isArray: function(obj){
      return Object.prototype.toString.call(obj) === '[object Array]';
    },
    
    /**
     * Merges two objects
     *
     * @param {Object} target The object that receives the keys
     * @param {Object} additional The object that supplies the keys
     * @api public
     */
    merge: function(target, additional){
      for (var i in additional)
        if (additional.hasOwnProperty(i))
          target[i] = additional[i];
    }
  };
  
  /**
   * Detect the iOS platform.
   *
   * @type {Boolean}
   * @api public
   */
  io.util.ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  
  /**
   * Detect the Android platform.
   *
   * @type {Boolean}
   * @api public
   */
  io.util.android = /android/i.test(navigator.userAgent);

  io.util.load(function(){
    pageLoaded = true;
  });

})();