/*!
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * @namespace
 */
var io = this.io = {
  /**
   * Version number of the socket.io-node-client.
   *
   * @static
   * @type {String}
   */
  version: '0.6.2',
  
  /**
   * Updates the location of the WebSocketMain.swf file that is required for the Flashsocket transport.
   *
   * @static
   * @deprecated Set the variable `WEB_SOCKET_SWF_LOCATION` pointing to WebSocketMain.swf
   * @param {String} path The path of the .swf file
   */
  setPath: function(path){
    if (window.console && console.error) console.error('io.setPath will be removed. Please set the variable WEB_SOCKET_SWF_LOCATION pointing to WebSocketMain.swf');
    this.path = /\/$/.test(path) ? path : path + '/';
    WEB_SOCKET_SWF_LOCATION = path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
  }
};

if ('jQuery' in this) jQuery.io = this.io;

if (typeof window != 'undefined'){
  // WEB_SOCKET_SWF_LOCATION = (document.location.protocol == 'https:' ? 'https:' : 'http:') + '//cdn.socket.io/' + this.io.version + '/WebSocketMain.swf';
  if (typeof WEB_SOCKET_SWF_LOCATION === 'undefined')
    WEB_SOCKET_SWF_LOCATION = '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf';
}