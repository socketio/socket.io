
/**
 * Module dependencies.
 */

var WebSocket = require('./websocket')
  , util = require('../util')

/**
 * Module exports.
 */

module.exports = FlashWS;

/**
 * Noop.
 */

function empty () { }

/**
 * FlashWS constructor.
 *
 * @param {Engine} engine instance.
 * @api public
 */

function FlashWS (options) {
  WebSocket.call(this, options);
};

/**
 * Inherits from WebSocket.
 */

util.inherits(FlashWS, WebSocket);

/**
 * Transport name.
 *
 * @api public
 */

FlashWS.prototype.name = 'flashsocket';

/**
 * Opens the transport.
 *
 * @api public
 */

FlashWS.prototype.doOpen = function () {
  if (!check) {
    // let the probe timeout
    return;
  }

  var base = io.enginePath + '/support/web-socket-js/'
    , self = this

  function log (type) {
    return function (msg) {
      return self.log(type, msg);
    }
  };

  // TODO: proxy logging to client logger
  WEB_SOCKET_LOGGER = { log: log('debug'), error: log('error') };
  WEB_SOCKET_SWF_LOCATION = base + '/WebSocketMainInsecure.swf';
  WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;

  load(base + 'swfobject.js', base + 'web_socket.js', function () {
    FlashWs.prototype.doOpen.call(self);
  });
};

/**
 * Feature detection for FlashSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

function check () {
  // if node
  return false;
  // end

  for (var i = 0, l = navigator.plugins.length; i < l; i++) {
    if (navigator.plugins[i].indexOf('Shockwave Flash')) {
      return true;
    }
  }

  return false;
};

/**
 * Dependency injection helper.
 * @license MIT - Copyright Dustin Diaz - Jacob Thornton - 2011
 */

var $script = (function () {
  var win = this, doc = document
    , head = doc.getElementsByTagName('head')[0]
    , validBase = /^https?:\/\//
    , old = win.$script, list = {}, ids = {}, delay = {}, scriptpath
    , scripts = {}, s = 'string', f = false
    , push = 'push', domContentLoaded = 'DOMContentLoaded', readyState = 'readyState'
    , addEventListener = 'addEventListener', onreadystatechange = 'onreadystatechange'

  function every(ar, fn, i) {
    for (i = 0, j = ar.length; i < j; ++i) if (!fn(ar[i])) return f
    return 1
  }
  function each(ar, fn) {
    every(ar, function(el) {
      return !fn(el)
    })
  }

  if (!doc[readyState] && doc[addEventListener]) {
    doc[addEventListener](domContentLoaded, function fn() {
      doc.removeEventListener(domContentLoaded, fn, f)
      doc[readyState] = 'complete'
    }, f)
    doc[readyState] = 'loading'
  }

  function $script(paths, idOrDone, optDone) {
    paths = paths[push] ? paths : [paths]
    var idOrDoneIsDone = idOrDone && idOrDone.call
      , done = idOrDoneIsDone ? idOrDone : optDone
      , id = idOrDoneIsDone ? paths.join('') : idOrDone
      , queue = paths.length
    function loopFn(item) {
      return item.call ? item() : list[item]
    }
    function callback() {
      if (!--queue) {
        list[id] = 1
        done && done()
        for (var dset in delay) {
          every(dset.split('|'), loopFn) && !each(delay[dset], loopFn) && (delay[dset] = [])
        }
      }
    }
    setTimeout(function () {
      each(paths, function(path) {
        if (scripts[path]) {
          id && (ids[id] = 1)
          return scripts[path] == 2 && callback()
        }
        scripts[path] = 1
        id && (ids[id] = 1)
        create(!validBase.test(path) && scriptpath ? scriptpath + path + '.js' : path, callback)
      })
    }, 0)
    return $script
  }

  function create(path, fn) {
    var el = doc.createElement('script')
      , loaded = f
    el.onload = el.onerror = el[onreadystatechange] = function () {
      if ((el[readyState] && !(/^c|loade/.test(el[readyState]))) || loaded) return;
      el.onload = el[onreadystatechange] = null
      loaded = 1
      scripts[path] = 2
      fn()
    }
    el.async = 1
    el.src = path
    head.insertBefore(el, head.firstChild)
  }

  $script.get = create

  $script.order = function (scripts, id, done) {
    (function callback(s) {
      s = scripts.shift()
      if (!scripts.length) $script(s, id, done)
      else $script(s, callback)
    }())
  }

  $script.path = function(p) {
    scriptpath = p
  }
  $script.ready = function(deps, ready, req) {
    deps = deps[push] ? deps : [deps]
    var missing = [];
    !each(deps, function(dep) {
      list[dep] || missing[push](dep);
    }) && every(deps, function(dep) {return list[dep]}) ?
      ready() : !function(key) {
      delay[key] = delay[key] || []
      delay[key][push](ready)
      req && req(missing)
    }(deps.join('|'))
    return $script
  }

  $script.noConflict = function () {
    win.$script = old;
    return this
  }

  return $script
});
