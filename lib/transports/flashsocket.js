
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

  // TODO: proxy logging to client logger
  WEB_SOCKET_LOGGER = { log: log('debug'), error: log('error') };
  WEB_SOCKET_SWF_LOCATION = base + '/WebSocketMainInsecure.swf';
  WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;

  load(base + 'swfobject.js', base + 'web_socket.js', function () {
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
    if (navigator.plugins[i].indexOf('Shockwave Flash')) {
      return true;
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

  var el = doc.createElement('script')
    , loaded = false

  el.onload = el.onreadystatechange = function () {
    var rs = el.readyState;

    if ((!rs || rs == 'loaded' || rs == 'complete') && !loaded) {
      el.onload = el.onreadystatechange = null;
      loaded = 1;
      // prevent double execution across multiple instances
      scripts[path] = true;
      fn();
    }
  };

  el.async = 1;
  el.src = path;

  head.insertBefore(el, head.firstChild);
};

/**
 * Loads scripts and fires a callback.
 *
 * @param {String} path (can be multiple parameters)
 * @param {Function} callback
 */

function load () {
  var total = arguments.length - 1
    , fn = arguments[total]

  for (var i = 0, l = total; i < l; i++) {
    create(arguments[i], function () {
      --total || fn();
    });
  }
};
