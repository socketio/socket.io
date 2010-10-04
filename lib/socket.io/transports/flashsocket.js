var net = require('net'),
    WebSocket = require('./websocket'),
    listeners = [],
    netserver,

Flashsocket = module.exports = function(){
  WebSocket.apply(this, arguments);
};

require('sys').inherits(Flashsocket, WebSocket);

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
};

try {
  netserver = net.createServer(function(socket){
    socket.write('<?xml version="1.0"?>\n');
    socket.write('<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n');
    socket.write('<cross-domain-policy>\n');

    listeners.forEach(function(l){
      [].concat(l.options.origins).forEach(function(origin){
        var parts = origin.split(':');
        socket.write('<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>\n');
      });
    });

    socket.write('</cross-domain-policy>\n');
    socket.end();
  });
  netserver.listen(843);
} catch(e){
  if (e.errno == 13){
    console.error("\x1B[1;31m" + [
      '================================================',
      '|               WARNING! DANGER!               |',
      '|                                              |',
      '| The flash websocket transport will not work  |', 
      '| unless you run your node instance with root  |',
      '| privileges.                                  |',
      '|                                              |',
      '| A flash XML policy file has to be served on  |',
      '| port 843 (privileged) for it to work.        |',
      '|                                              |',
      '| You can run socket.io without this transport |',
      '| to make this message go (refer to README).   |',
      '|                                              |',
      '===============================================|'
    ].join("\n") + "\x1B[0m");
  }
  netserver = null;
}