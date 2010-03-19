// OO - Class - Copyright TJ Holowaychuk <tj@vision-media.ca> (MIT Licensed)
// Based on http://ejohn.org/blog/simple-javascript-inheritance/
// which is based on implementations by Prototype / base2

(function(){

  var global = this, initialize = true
  var referencesSuper = /xyz/.test(function(){ xyz }) ? /\b__super__\b/ : /.*/

  /**
   * Shortcut for ioClass.extend()
   *
   * @param  {hash} props
   * @return {function}
   * @api public
   */

  ioClass = function(props){
    if (this == global)
      return ioClass.extend(props)  
  }
  
  // --- Version
  
  ioClass.version = '1.2.0'
  
  /**
   * Create a new ioClass.
   *
   *   User = ioClass({
   *     init: function(name){
   *       this.name = name
   *     }
   *   })
   *
   * ioClasses may be subioClassed using the .extend() method, and
   * the associated superioClass method via this.__super__().
   *
   *   Admin = User.extend({
   *     init: function(name, password) {
   *       this.__super__(name)
   *       // or this.__super__.apply(this, arguments)
   *       this.password = password
   *     }
   *   })
   *
   * @param  {hash} props
   * @return {function}
   * @api public
   */
  
  ioClass.extend = function(props) {
    var __super__ = this.prototype
    
    initialize = false
    var prototype = new this
    initialize = true

    function ioClass() {
      if (initialize && this.init)
        this.init.apply(this, arguments)
    }
    
    function extend(props) {
      for (var key in props)
        if (props.hasOwnProperty(key))
          ioClass[key] = props[key]
    }
    
    ioClass.include = function(props) {
      for (var name in props)
        if (name == 'include')
          if (props[name] instanceof Array)
            for (var i = 0, len = props[name].length; i < len; ++i)
              ioClass.include(props[name][i])
          else
            ioClass.include(props[name])
        else if (name == 'extend')
          if (props[name] instanceof Array)
            for (var i = 0, len = props[name].length; i < len; ++i)
              extend(props[name][i])
          else
            extend(props[name])
        else if (props.hasOwnProperty(name))
          prototype[name] = 
            typeof props[name] == 'function' &&
            typeof __super__[name] == 'function' &&
            referencesSuper.test(props[name]) ?
              (function(name, fn){
                return function() {
                  this.__super__ = __super__[name]
                  return fn.apply(this, arguments)
                }
              })(name, props[name])
            : props[name]
    }
    
    ioClass.include(props)
    ioClass.prototype = prototype
    ioClass.constructor = ioClass
    ioClass.extend = arguments.callee
    
    return ioClass
  }

})();