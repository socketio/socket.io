
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
 
var flashpolicy;

/**
 * Listens for new configuration changes of the Manager
 * this way we can enable and disable the flash server.
 *
 * @param {Manager} Manager A reference to the started
 * @api private
 */
FlashSocket.attach = function (Manager) {
  function createServer (){
    flashpolicy = policyfile.createServer(
      { log: console.log }
    , Manager.get('origins')
    );
    
    flashpolicy.listen(Manager.get('flash policy port'), Manager.server)
  }

  // listen for origin changes, so we can update the server
  Manager.on('update:origins', function (value, key) {
    if (!flashpolicy) return;

    // update the origins and compile a new response buffer
    flashpolicy.origins = value;
    flashpolicy.compile();
  });

  // destory the server and create a new server
  Manager.on('update:flash policy port', function (value, key) {
    if (
       ! flashpolicy
      || flashpolicy.port === value
      || !~Manager.get('transports').indexOf('flashsocket')
    ) return;

    // destroy the server and rebuild it on a new port
    flashpolicy.close();
    createServer();
  });

  // only start the server
  Manager.on('update:transports', function (value, key){
    if (
       flashpolicy
       || !~Manager.get('transports').indexOf('flashsocket')
    ) return;

    createServer();
  });
};