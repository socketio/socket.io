var net = require('net')
  , WebSocket = require('./websocket')
  , netserver = null;

var Flashsocket = module.exports = function(){
  WebSocket.apply(this, arguments);
};

require('sys').inherits(Flashsocket, WebSocket);

Flashsocket.httpUpgrade = true;

Flashsocket.init = function(listener){
  // if we could not listen to port 843 or the flashPolicyServer has been disabled
  // the policy requests will be served inline
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
  
  if(listener.options && listener.options.flashPolicyServer){
		netserver = net.createServer(function(socket){
			socket.addListener('error', function(err){
				socket.end && socket.end();
				socket.destroy && socket.destroy();
			});
	
			if (socket && socket.readyState == 'open')
				socket.end(policy([listener]));
		});
		
		netserver.addListener('error', function(err){
			if(err && err.errno == 13)
				listener.options.log('Your node instance does not have root privileges, the flash policy file will only be served inline.');
		});
		
		listener.server.addListener('close', function(){
			if(listener && netserver){
				try{
					netserver.close();
				}catch(err){	}
			}
		});
		
		// fall back to try catch for node < 0.2.4, node 0.3.0 does propperly catches the error. 
		try{
			netserver.listen(843);
		} catch(err){
			if(err && err.errno == 13)
				listener.options.log('Your node instance does not have root privileges, the flash policy file will only be served inline.');
		}
  }
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