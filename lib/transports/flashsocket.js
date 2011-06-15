
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var WebSocket = require('./websocket');

/**
 * Export the constructor.
 */

exports = module.exports = FlashSocket;

/**
 * FlashSocket constructor.
 *
 * @api public
 */

var policyServer;

function FlashSocket() {
  WebSocket.apply(this, arguments);
  // start flash policy inline server
console.error('NEW FS transport');
  if (!policyServer) {
    var manager = this.manager;
    manager.log.info('FlashSocket transport is probed. Need to start flash policy server');
    policyServer = manager.server;
    policyServer.on('connection', function(stream) {
      stream.once('data', function (data) {
        // Only check the initial data
        if (data[0] === 60 && data.length === 23) {
          if (data === '<policy-file-request/>\0') {
            manager.log.info('Answering flash policy request inline');
            if (stream && stream.readyState === 'open') {
              var xml = defaultPolicy;
              stream.write(xml);
              stream.end();
            }
          }
        }
      });
    });
  }
};

var defaultPolicy =
  '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM' +
  ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n' +
  '<allow-access-from domain="*" to-ports="*"/>\n' +
  '</cross-domain-policy>\n';

/**
 * Inherits from WebSocket.
 */

FlashSocket.prototype.__proto__ = WebSocket.prototype;

FlashSocket.httpUpgrade = true;

/***
FlashSocket.init = function(listener) {
  listeners.push(listener);
  
  listener.server.on('close', function(){
    listeners.splice(listeners.indexOf(listener), 1);

    if (listeners.length === 0 && netserver){
      try {
        netserver.close();
      } catch(e){
	    listener.options.log('flashsocket netserver close error - ' + e.stack)
      }
    }
  });
  
  if (listener.options.flashPolicyServer && netserver === undefined){
    netserver = net.createServer(function(socket){
      socket.addListener('error', function(err){
        if (socket && socket.end){
          socket.end();
          socket.destroy();
        }
      });

      if(socket && socket.readyState == 'open')
        socket.end(policy(listeners));
    });
    
    try {
      netserver.listen(843);
    } catch(e){
      if (e.errno == 13)
        listener.options.log('Your node instance does not have root privileges. ' 
                           + 'This means that the flash XML policy file will be '
                           + 'served inline instead of on port 843. This will slow '
                           + 'down initial connections slightly.');
      netserver = null;
    }
  }
};


function policy(listeners) {
  var xml = '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM'
          + ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n';

  listeners.forEach(function(l){
    [].concat(l.options.origins).forEach(function(origin){
      var parts = origin.split(':');
      xml += '<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>\n';
    });
  });

  xml += '</cross-domain-policy>\n';
  return xml;
};
***/
