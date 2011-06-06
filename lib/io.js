
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports) {

  /**
   * IO namespace.
   *
   * @namespace
   */

  var io = exports;

  /**
   * Socket.IO version
   *
   * @api public
   */

  io.version = '0.7.0';

  /**
   * Protocol implemented.
   *
   * @api public
   */

  io.protocol = 1;

  /**
   * Available transports
   *
   * @api public
   */

  io.transports = [
      'websocket'
    , 'htmlfile'
    , 'xhr-polling'
    , 'jsonp-polling'
  ];

  /**
   * Keep track of jsonp callbacks.
   *
   * @api private
   */

  io.j = [];
  
  /**
   * Keep track of our io.Sockets
   *
   * @api private
   */
  io.sockets = {};

  /**
   * Expose constructors if in Node
   */

  // if node
  if ('object' === typeof module && 'function' === typeof require) {

    /**
     * Expose utils
     *
     * @api private
     */
    
    io.util = require('./util').util;

    /**
     * Expose EventEmitter
     *
     * @api private
     */

    io.EventEmitter = process.EventEmitter;

    /**
     * Expose Transport
     *
     * @api public
     */

    io.Transport = require('./transport').Transport;

    /**
     * Expose all transports
     */
    
    io.transports.forEach(function (t) {
      //io.Transport[t] = require('./transports/node/' + t);
    });

    /**
     * Expose Socket
     *
     * @api public
     */
    
    io.Socket = require('./socket').Socket;

  }
  // end node

  /**
   * Manages connections to hosts.
   *
   * @param {String} uri
   * @Param {Boolean} force creation of new socket (defaults to false)
   * @api public
   */

  io.connect = function (host, forceNew) {
    var uri = io.util.parseUri(host)
      , uuri = io.util.uniqueUri(uri);

    if (forceNew || !io.sockets[uuri]) {
      var socket = new io.Socket({
          host: uri.host
        , secure: uri.protocol == 'https://'
        , port: uri.port || 80
      });
    }

    if (!forceNew) {
      this.sockets[uuri] = socket;
    }

    // if path is different from '' or /
    return socket.of(uri.path.length > 1 ? uri.path : '');
  };

})('object' === typeof module ? module.exports : (window.io = {}));
