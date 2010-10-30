var net = require('net')
  , WebSocket = require('./websocket')
  , listeners = []
  , netserver = null;

var Flashsocket = module.exports = function(){
  WebSocket.apply(this, arguments);
};

require('sys').inherits(Flashsocket, WebSocket);

Flashsocket.httpUpgrade = true;

Flashsocket.init = function(listener){
  // Could not listen on port 843 so policy requests will be inline
  listener.server.addListener('connection', function(stream){
    var flashCheck = function (data) {
      // Only check the initial data
      stream.removeListener('data', flashCheck);
      if (data[0] === 60 && data.length == 23 && data == '<policy-file-request/>\0'){
        if (stream && stream.readyState == 'open'){
          var xml = policy([listener]);
          stream.write(xml);
          stream.end();
        }
      }
    };
    stream.on("data", flashCheck);
  });
};

function policy(listeners) {
  var xml = '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n';

  listeners.forEach(function(l){
    [].concat(l.options.origins).forEach(function(origin){
      var parts = origin.split(':');
      xml += '<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>\n';
    });
  });

  xml += '</cross-domain-policy>\n';
  return xml;
};