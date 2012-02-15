
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
 * FlashWS constructor.
 *
 * @api public
 */

function FlashWS (options) {
  WebSocket.call(this, options);
  this.flashPath = options.flashPath;
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
  if (!check()) {
    // let the probe timeout
    return;
  }

  // instrument websocketjs logging
  function log (type) {
    return function () {
      var str = Array.prototype.join.call(arguments, ' ');
      // debug: [websocketjs %s] %s, type, str
    }
  };

  WEB_SOCKET_LOGGER = { log: log('debug'), error: log('error') };
  WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;

  // dependencies
  var deps = [path + 'web_socket.js'];

  if ('undefined' == typeof swfobject) {
    deps.unshift(path + 'swfobject.js');
  }

  load(deps, function () {
    FlashWS.prototype.doOpen.call(self);
  });
};

/**
 * Override to prevent closing uninitialized flashsocket.
 *
 * @api private
 */

FlashWS.prototype.doClose = function () {
  if (!this.socket) return;
  FlashWS.prototype.doClose.call(this);
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
    for (var j = 0, m = navigator.plugins[i].length; j < m; j++) {
      if (navigator.plugins[i][j] == 'Shockwave Flash') return true;
    }
  }

  return false;
};

/**
 * Lazy loading of scripts.
 * Based on $script by Dustin Diaz - MIT
 */

var scripts = {};

/**
 * Injects a script. Keeps tracked of injected ones.
 *
 * @param {String} path
 * @param {Function} callback
 * @api private
 */

function create (path, fn) {
  if (scripts[path]) return fn();

  var el = document.createElement('script')
    , loaded = false

  // debug: loading "%s", path
  el.onload = el.onreadystatechange = function () {
    if (loaded || scripts[path]) return;
    var rs = el.readyState;
    if (!rs || 'loaded' == rs || 'complete' == rs) {
      // debug: loaded "%s", path
      el.onload = el.onreadystatechange = null;
      loaded = true;
      scripts[path] = true;
      fn();
    }
  };

  el.async = 1;
  el.src = path;

  var head = document.getElementsByTagName('head')[0];
  head.insertBefore(el, head.firstChild);
};

/**
 * Loads scripts and fires a callback.
 *
 * @param {Array} paths
 * @param {Function} callback
 */

function load (arr, fn) {
  function process (i) {
    if (!arr[i]) return fn();
    create(arr[i], function () {
      process(arr[++i]);
    });
  };

  process(0);
};
