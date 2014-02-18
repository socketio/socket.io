
/**
 * Module dependencies.
 */

var WebSocket = require('./websocket');

/**
 * Exports the constructor.
 */

module.exports = FlashSocket;

/**
 * The FlashSocket transport is just a proxy for WebSocket connections.
 *
 * @param {http.ServerRequest} request
 * @api public
 */
 
function FlashSocket (req) {
  WebSocket.call(this, req);
}

/**
 * Inherits from WebSocket.
 */

FlashSocket.prototype.__proto__ = WebSocket.prototype;

/**
 * Transport name
 *
 * @api public
 */

FlashSocket.prototype.name = 'flashsocket';

/**
 * Advertise framing support.
 *
 * @api public
 */

FlashSocket.prototype.supportsFraming = true;

/**
 * Listens for new configuration changes of the Manager
 * this way we can enable and disable the flash server.
 *
 * @param {Manager} Manager instance.
 * @api private
 */

FlashSocket.init = function (manager) {
  var server;
  function create () {
    server = require('policyfile').createServer({ 
      log: function(msg){
        manager.log.info(msg.toLowerCase());
      }
    }, manager.get('origins'));

    server.on('close', function (e) {
      server = null;
    });

    server.listen(manager.get('flash policy port'), manager.server);

    manager.flashPolicyServer = server;
  }

  // listen for origin changes, so we can update the server
  manager.on('set:origins', function (value, key) {
    if (!server) return;

    // update the origins and compile a new response buffer
    server.origins = Array.isArray(value) ? value : [value];
    server.compile();
  });

  // destory the server and create a new server
  manager.on('set:flash policy port', function (value, key) {
    var transports = manager.get('transports');
    if (~transports.indexOf('flashsocket')) {
      if (server) {
        if (server.port === value) return;
        // destroy the server and rebuild it on a new port
        try {
          server.close();
        }
        catch (e) { /* ignore exception. could e.g. be that the server isn't started yet */ }
      }
      create();
    }
  });

  // only start the server
  manager.on('set:transports', function (value, key){
    if (!server && ~manager.get('transports').indexOf('flashsocket')) {
      create();
    }
  });
  // check if we need to initialize at start
  if (~manager.get('transports').indexOf('flashsocket')){
    create();
  }
};
