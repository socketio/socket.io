/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * Set when the `onload` event is executed on the page. This variable is used by
   * `io.util.load` to detect if we need to execute the function immediately or add
   * it to a onload listener.
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
     * Example:
     *
     *     io.util.load(function(){ console.log('page loaded') });
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
     * Defers the function untill it's the function can be executed without
     * blocking the load process. This is especially needed for WebKit based
     * browsers. If a long running connection is made before the onload event
     * a loading indicator spinner will be present at all times untill a
     * reconnect has been made.
     *
     * @param {Function} fn
     * @api public
     */
    defer: function(fn){
      if (!io.util.webkit) return fn();
      io.util.load(function(){
        setTimeout(fn,100);
      });
    },
    
    /**
     * Inherit the prototype methods from one constructor into another.
     *
     * Example:
     *
     *     function foo(){};
     *     foo.prototype.hello = function(){ console.log( this.words )};
     *     
     *     function bar(){
     *       this.words = "Hello world";
     *     };
     *     
     *     io.util.inherit(bar,foo);
     *     var person = new bar();
     *     person.hello();
     *     // => "Hello World"
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
     * Example:
     *
     *     var data = ['socket',2,3,4,'socket',5,6,7,'io'];
     *     io.util.indexOf(data,'socket',1);
     *     // => 4
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
     * Example:
     *
     *     io.util.isArray([]);
     *     // => true
     *     io.util.isArray({});
     *    // => false
     *
     * @param obj
     * @api public
     */
    isArray: function(obj){
      return Object.prototype.toString.call(obj) === '[object Array]';
    },
    
    /**
     * Merges the properties of two objects.
     *
     * Example:
     *
     *     var a = {foo:'bar'}
     *       , b = {bar:'baz'};
     *     
     *     io.util.merge(a,b);
     *     // => {foo:'bar',bar:'baz'}
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
   * Detect the Webkit platform based on the userAgent string.
   * This includes Mobile Webkit.
   *
   * @type {Boolean}
   * @api public
   */
  io.util.webkit = /webkit/i.test(navigator.userAgent);
  
  io.util.load(function(){
    pageLoaded = true;
  });

})();