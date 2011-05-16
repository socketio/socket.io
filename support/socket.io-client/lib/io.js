/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * @namespace
 */
var io = this.io = {
  
  /**
   * Library version.
   */
  version: '0.6.3',
  
  /**
   * Updates the location of the WebSocketMain.swf file that is required for the Flashsocket transport.
   * This should only be needed if you want to load in the WebSocketMainInsecure.swf or if you want to
   * host the .swf file on a other server.
   *
   * @static
   * @deprecated Set the variable `WEB_SOCKET_SWF_LOCATION` pointing to WebSocketMain.swf
   * @param {String} path The path of the .swf file
   * @api public
   */
  setPath: function(path){
    if (window.console && console.error) console.error('io.setPath will be removed. Please set the variable WEB_SOCKET_SWF_LOCATION pointing to WebSocketMain.swf');
    this.path = /\/$/.test(path) ? path : path + '/';
    WEB_SOCKET_SWF_LOCATION = path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
  }
};

/**
 * Expose Socket.IO in jQuery
 */
if ('jQuery' in this) jQuery.io = this.io;

/**
 * Default path to the .swf file.
 */
if (typeof window != 'undefined'){
  // WEB_SOCKET_SWF_LOCATION = (document.location.protocol == 'https:' ? 'https:' : 'http:') + '//cdn.socket.io/' + this.io.version + '/WebSocketMain.swf';
  if (typeof WEB_SOCKET_SWF_LOCATION === 'undefined')
    WEB_SOCKET_SWF_LOCATION = '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf';
}
