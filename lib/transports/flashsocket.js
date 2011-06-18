
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */
var policyfile = require('policyfile')
  , WebSocket = require('./websocket');

/**
 * Export the constructor.
 */

exports = module.exports = FlashSocket;

/**
 * The FlashSocket transport is just a proxy
 * for WebSocket connections.
 *
 * @api public
 */
 
function FlashSocket () {
  WebSocket.apply(this, arguments);
  this.name = 'flashsocket';
}

/**
 * Inherits from WebSocket.
 */

FlashSocket.prototype.__proto__ = WebSocket.prototype;

/**
 * Global for the server instance
 */
 
var server;

/**
 * Listens for new configuration changes of the Manager
 * this way we can enable and disable the flash server.
 *
 * @param {Manager} Manager A reference to the started
 * @api private
 */
FlashSocket.attach = function (Manager) {
  function createServer (){
    server = policyfile.createServer(
      { 
        log: function(msg){
          Manager.log.info(msg);
        }
      }
    , Manager.get('origins')
    );

    server.on('close', function (e) {
      server = null;
    });

    server.listen(
      Manager.get('flash policy port')
    , Manager.server
    );

    Manager.flashPolicyServer = server;
  }

  // listen for origin changes, so we can update the server
  Manager.on('set:origins', function (value, key) {
    if (!server) return;

    // update the origins and compile a new response buffer
    server.origins = Array.isArray(value) ? value : [value];
    server.compile();
  });

  // destory the server and create a new server
  Manager.on('set:flash policy port', function (value, key) {
    if (
       ! server
      || server.port === value
      || !~Manager.get('transports').indexOf('flashsocket')
    ) return;

    // destroy the server and rebuild it on a new port
    server.close();
    createServer();
  });

  // only start the server
  Manager.on('set:transports', function (value, key){
    if (
       server
       || !~Manager.get('transports').indexOf('flashsocket')
    ) return;

    createServer();
  });

  // check if we need to initalize at start
  if (~Manager.get('transports').indexOf('flashsocket')){
    createServer();
  }
};