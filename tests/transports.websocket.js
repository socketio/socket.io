var io = require('socket.io'),
    Listener = io.Listener,
    Client = require('socket.io/client'),
    WebSocket = require('./../support/node-websocket-client/lib/websocket').WebSocket,
    encode = require('socket.io/utils').encode,
    decode = require('socket.io/utils').decode;

module.exports = {
  
  'test connection and handshake': function(assert){
    var server = require('http').createServer(function(){}), 
        sio, 
        close = function(){
          client.close();
          server.close();
          assert.ok(clientCount, 1);
          assert.ok(clientMessage, 'from client');
          assert.ok(serverMessage, 'from server');
        },
        check = function(){
          if (++trips == 2) close();
        },
        trips = 0,
        clientCount = 0,
        client, 
        clientMessage, 
        serverMessage;
    
    sio = io.listen(server, {log: function(){}});
    
    server.listen(8081, function(){
      var messages = 0;
      client = new WebSocket('ws://localhost:8081/socket.io/websocket', 'borf');
      client.onopen = function(){
        client.send(encode('from client'));
      };
      client.onmessage = function(ev){
        if (++messages == 2){ // first message is the session id
          serverMessage = decode(ev.data);
          check();
        }
      };
    });
    
    sio.on('connection', function(client){
      clientCount++;
      assert.ok(client instanceof Client);
      client.on('message', function(msg){
        clientMessage = msg;
        check();
      });
      client.send('from server');
    });
  }
  
};