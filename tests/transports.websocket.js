var io = require('socket.io')
  , port = 7200
  , Listener = io.Listener
  , Client = require('socket.io/client');

require('socket.io/tests');

function listen(s, callback){
  s._port = port;
  s.listen(port, callback);
  port++;
  return s;
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
      _client = client(_server);
      _client.onopen = function(){
        _client.send(encode('from client'));
      };
      _client.onmessage = function(ev){
        decode(ev.data, function(msg, type){
          messages++;
          if (messages == 1){
            assert.ok(type == '3');
          } else if (messages == 2){
            assert.ok(msg[0] === 'from server');
            --trips || close();
          }
        });
      };
    });
    
    _socket.on('connection', function(conn){
      assert.ok(conn instanceof Client);
      conn
        .on('message', function(msg){
          assert.ok(msg == 'from client');
          --trips || close();
        })
        .send('from server');
    });
  },
  
  'test clients tracking': function(assert){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = client(_server);
      _client.onopen = function(){
        assert.ok(Object.keys(_socket.clients).length == 1);
  
        var _client2 = client(_server);
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
              decode(ev.data, function(msg){
                assert.ok(msg[0] === 'should get this');
                _socket.clients[sessionid].options.closeTimeout = 0;
                _client2.close();
                _server.close();
              });
            };
            runOnce = true;
          }
        });
        
        _client.close();
      };
    });
  },
  
  'test json encoding': function(assert){
    var _server = server()
      , _socket = socket(_server)
      , _client
      , trips = 2;
    
    function close(){
      _server.close();
      _client.close();
    };
    
    listen(_server, function(){
      _socket.on('connection', function(conn){
        conn.on('message', function(msg){
          assert.ok(msg.from == 'client');
          --trips || close();
        });
        conn.send({ from: 'server' });
      });
      
      var messages = 0;
      
      _client = client(_server);
      _client.onmessage = function(ev){
        if (++messages == 2){
          decode(ev.data, function(msg){
            assert.ok('j' in msg[1]);
            _client.send(encode({ from: 'client' }));
            --trips || close();
          });
        }
      };
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
        decode(ev.data, function(msg, type){
          if (type === '2'){
            assert.ok(messages === 2);
            assert.ok(msg === '1');
            assert.ok(Object.keys(_socket.clients).length == 1);
            setTimeout(function(){
              assert.ok(Object.keys(_socket.clients).length == 0);
              _client.close();
              _server.close();
            }, 150);
          }
        });
      };
    });
  },
  
  'test client broadcast': function(assert){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = client(_server)
        , _client2
        , _client3
        , _first
        , _connections = 0;
        
      _client.onmessage = function(ev){
        if (!('messages' in _client)) _client.messages = 0;
        if (++_client.messages == 2){
          decode(ev.data, function(msg){
            assert.ok(msg[0] === 'not broadcasted');
            _client.close();
            _client2.close();
            _client3.close();
            _server.close();
          });
        }
      };
      
      _client.onopen = function(){
        _client2 = client(_server);
        _client2.onmessage = function(ev){
          if (!('messages' in _client2)) _client2.messages = 0;
          if (++_client2.messages == 2)
            decode(ev.data, function(msg){
              assert.ok(msg[0] === 'broadcasted');
            });
        };
        _client2.onopen = function(){
          _client3 = client(_server);
          _client3.onmessage = function(ev){
            if (!('messages' in _client3)) _client3.messages = 0;
            if (++_client3.messages == 2)
              decode(ev.data, function(msg){
                assert.ok(msg[0] === 'broadcasted');
              });
          };
        };
      };
      
      _socket.on('connection', function(conn){
        if (!_first)
          _first = conn;
        if (++_connections == 3){
          _first.broadcast('broadcasted');
          _first.send('not broadcasted');
        }
      });
      
    });
  },

  'test realms': function(){
  }
  
};
