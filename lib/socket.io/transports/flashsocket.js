var net = require('net')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , WebSocket = require('./websocket')
  , listeners = []
  , netserver;

var Flashsocket = module.exports = function(){
  WebSocket.apply(this, arguments);
};

util.inherits(Flashsocket, WebSocket);

Flashsocket.httpUpgrade = true;

Flashsocket.init = function(listener){
  listeners.push(listener);
  
  listener.server.on('close', function(){
    listeners.splice(listeners.indexOf(listener), 1);

    if (listeners.length === 0 && netserver){
      try {
        netserver.close();
      } catch(e){}
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
                           + 'down initial connections slightly. NOTE: this fails '
                           + 'with Firefox 4 betas.');
      netserver = null;
    }
  }
  
  // Could not listen on port 843 so policy requests will be inline
  listener.server.addListener('connection', function(stream){
    var flashCheck = function (data) {
      // Only check the initial data
      stream.removeListener("data", flashCheck);
      if (data[0] === 60 && data.length == 23) {
        if (data == '<policy-file-request/>\0') {
          listener.options.log("Answering flash policy request inline");
          if (stream && stream.readyState == 'open'){
            var xml = policy([listener]);
            stream.write(xml);
            stream.end();
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
    [].concat(l.options.origins).forEach(function(origin){
      var parts = origin.split(':');
      xml += '<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>\n';
    });
  });

  xml += '</cross-domain-policy>\n';
  return xml;
};
