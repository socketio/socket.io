var io = require('socket.io')
  , encode = require('socket.io/utils').encode
  , decode = require('socket.io/utils').decode
  , port = 8000
  , Listener = io.Listener
  , Client = require('socket.io/client')
  , WebSocket = require('./../support/node-websocket-client/lib/websocket').WebSocket;

function server(){
  return require('http').createServer(function(){});
};

function socket(server, options){
  if (!options) options = {};
  options.log = false;
  return io.listen(server, options);
};

function listen(s, callback){
  s._port = port;
  s.listen(port, callback);
  port++;
  return s;
};

function client(server, sessid){
  sessid = sessid ? '/' + sessid : '';
  return new WebSocket('ws://localhost:' + server._port + '/socket.io/websocket' + sessid, 'borf');
};

module.exports = {
  
  'test connection and handshake': function(assert){
    var _server = server()
      , _socket = socket(_server)
      , _client
      , trips = 2;
    
    function close(){
      _client.close();
      _server.close();
    };
    
    listen(_server, function(){
      var messages = 0;
      _client = client('ws://localhost:8081/socket.io/websocket', 'borf');
      _client.onopen = function(){
        _client.send(encode('from client'));
      };
      _client.onmessage = function(ev){
        if (++messages == 2){ // first message is the session id
          assert.ok(decode(ev.data), 'from server');
          --trips || close();
        }
      };
    });
    
    _socket.on('connection', function(client){
      clientCount++;
      assert.ok(client instanceof Client);
      _client.on('message', function(msg){
        assert.ok(msg == 'from client');
        --trips || close();
      });
      _client.send('from server');
    });
  },
  
  'test clients tracking': function(assert){
    var _server = server()
      , _socket = socket(_server);
      
    listen(_server, function(){
      var _client = client(server);
      _client.onopen = function(){
        assert.ok(Object.keys(_socket.clients).length == 1);
  
        var _client2 = client(server);
        _client2.onopen = function(){
          assert.ok(Object.keys(_socket.clients).length == 2);
          
          _client.close();
          _client2.close();
          _server.close();
        };
      }
    });
  },
  
  'test buffered messages': function(assert){
    var _server = server()
      , _socket = socket(_server, {
          transportOptions: {
            websocket: {
              closeTimeout: 5000
            }
          }
        });
      
    listen(_server, function(){
      var _client = client(_server);
      
      _client.onopen = function(){
        assert.ok(Object.keys(_socket.clients).length == 1);
        var sessionid = Object.keys(_socket.clients)[0]
          , runOnce = false;
  
        _socket.clients[sessionid].connection.addListener('end', function(){
          if (!runOnce){
            assert.ok(_socket.clients[sessionid]._open == false);
            assert.ok(_socket.clients[sessionid].connected);
            _socket.clients[sessionid].send('should get this');
  
            var _client2 = client(_server, sessionid);
            _client2.onmessage = function(ev){
              assert.ok(Object.keys(_socket.clients).length == 1);
              assert.ok(decode(ev.data), 'should get this');
              _socket.clients[sessionid].options.closeTimeout = 0;
              _client2.close();
              _server.close();
            };
            runOnce = true;
          }
        });
        
        _client.close();
      };
    });
  },
  
  'test json encoding': function(){
    var _server = server()
      , _socket = socket(_server);
      
    listen(_server, function(){
      
    });
  },
  
  'test hearbeat timeout': function(assert){
    var _server = server()
      , _socket = socket(_server, {
          transportOptions: {
            websocket: {
              timeout: 100,
              heartbeatInterval: 1
            }
          }
        });
    
    listen(_server, function(){
      var _client = client(_server)
        , messages = 0;
      _client.onmessage = function(ev){
        ++messages;
        if (ev.data.substr(0, 3) == '~h~'){
          assert.ok(messages === 2);
          assert.ok(Object.keys(_socket.clients).length == 1);
          setTimeout(function(){
            assert.ok(Object.keys(_socket.clients).length == 0);
            _client.close();
            _server.close();
          }, 150);
        }
        
      };
    });
  }
  
};