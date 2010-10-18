var io = require('socket.io')
  , Listener = io.Listener
  , Client = require('socket.io/client')
  , WebSocket = require('../support/node-websocket-client/lib/websocket').WebSocket;

module.exports = {

  'test server initialization': function(assert){
    var server = require('http').createServer(function(){}), sio;
    server.listen(8080);
    sio = io.listen(server, { log: null });
    assert.ok(sio instanceof Listener);
    setTimeout(function(){
      server.close();
    }, 100);
  },
  
  'test serving static javascript client': function(assert){
    var server = require('http').createServer(function(){})
      , sio = io.listen(server, { log: null });
    assert.response(server
     , { url: '/socket.io/socket.io.js' }
     , { body: /setPath/, headers: { 'Content-Type': 'text/javascript' }});
    assert.response(server
     , { url: '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf' }
     , { headers: { 'Content-Type': 'application/x-shockwave-flash' }});
  }

};