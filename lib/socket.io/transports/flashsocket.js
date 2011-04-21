
/*!
 * Socket.IO - transports - Flashsocket
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

var net = require('net')
  , WebSocket = require('./websocket')
  , listeners = []
  , netserver;

/**
 * Expose `Flashsocket`.
 */

module.exports = Flashsocket;

/**
 * Initialize a `Flashsocket`.
 *
 * @api private
 */

function Flashsocket() {
  WebSocket.apply(this, arguments);
};

/**
 * Inherit from `WebSocket.prototype`.
 */

Flashsocket.prototype.__proto__ = WebSocket.prototype;

/**
 * Requires upgrade.
 */

Flashsocket.httpUpgrade = true;

Flashsocket.init = function(listener){
  listeners.push(listener);
  
  listener.server.on('close', function(){
    listeners.splice(listeners.indexOf(listener), 1);

    if (listeners.length === 0 && netserver){
      try {
        netserver.close();
      } catch(e){
        listener.log('flashsocket netserver close error - ' + e.stack)
      }
    }
  });
  
  if (listener.flashPolicyServer && netserver === undefined){
    netserver = net.createServer(function(socket){
      socket.addListener('error', function(err){
        if (socket && socket.end){
          socket.end();
          socket.destroy();
        }
      });

      if (socket && socket.readyState == 'open') {
        socket.end(policy(listeners));
      }
    });
    
    try {
      netserver.listen(843);
    } catch(e){
      if (e.errno == 13)
        listener.log(
          'Your node instance does not have root privileges. ' 
          + 'This means that the flash XML policy file will be '
          + 'served inline instead of on port 843. This will slow '
          + 'down initial connections slightly.');
      netserver = null;
    }
  }
  
  // Could not listen on port 843 so policy requests will be inline
  listener.server.on('connection', function(stream){
    var flashCheck = function (data) {
      // Only check the initial data
      stream.removeListener("data", flashCheck);
      if (data[0] === 60 && data.length == 23) {
        if (data == '<policy-file-request/>\0') {
          listener.log("Answering flash policy request inline");
          if (stream && stream.readyState == 'open'){
            var xml = policy([listener]);
            stream.end(xml);
          }
        }
      }
    };
    
    stream.on('data', flashCheck);
  });
};

function policy(listeners) {
  var xml = '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM'
          + ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n';

  listeners.forEach(function(l){
    [].concat(l.origins).forEach(function(origin){
      var parts = origin.split(':');
      xml += '<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>\n';
    });
  });

  xml += '</cross-domain-policy>\n';
  return xml;
};
