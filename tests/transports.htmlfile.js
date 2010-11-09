var io = require('socket.io')
  , net = require('net')
  , http = require('http')
  , querystring = require('querystring')
  , port = 7600
  , encode = require('socket.io/utils').encode
  , decode = require('socket.io/utils').decode
  , EventEmitter = require('events').EventEmitter
  , HTMLFile = require('socket.io/transports/htmlfile');
  
function server(callback){
  return http.createServer(function(){});
};

function listen(s, callback){
  s._port = port;
  s.listen(port, callback);
  port++;
  return s;
};

function client(s){
  return http.createClient(s._port, 'localhost');
};

function socket(server, options){
  if (!options) options = {};
  options.log = false;
  if (!options.transportOptions) options.transportOptions = { 
    'htmlfile': {
      // disable heartbeats for tests, re-enabled in heartbeat test below
      timeout: null 
    }
  };
  return io.listen(server, options);
};

function get(server, url, assert, callback){
  var client = http.createClient(server._port)
    , request = client.request('GET', url, {host: 'localhost'})
    , emitter = new EventEmitter
    , messages = 0;
  
  request.end();
  request.on('response', function(resp){
    callback(emitter);
    resp.on('data', function(data){
      var msg = data.toString();
      if (++messages == 1){
        // make sure to send 256 bytes of data IE needs
        assert.ok(data.length >= 256); 
        assert.ok(msg.indexOf('<html>') != -1);
        assert.ok(msg.indexOf('<body>') != -1);
      } else {
        // make sure element is wrapped in a script tag and a javascript call
        assert.ok(/^<script>parent.s\._\("/.test(msg));
        assert.ok(/", document\);<\/script>$/.test(msg));
        
        emitter.emit('data', msg.substr(20, msg.length - 42));
      }
    });
  });
  
  client.end = function(){
    request.connection.destroy();
  };

  return client;
};

function post(client, url, data, callback){
  var query = querystring.stringify(data)
    , request = client.request('POST', url, {'Content-Length': Buffer.byteLength(query)});
  request.write(query);
  request.end();
};

module.exports = {
  
  'test connection and handshake': function(assert){
    var _server = server()
      , _socket = socket(_server)
      , trips = 2;

    listen(_server, function(){
      var _client = get(_server, '/socket.io/htmlfile', assert, function(response){
        var i = 0;
        response.on('data', function(data){
          var msg = decode(data);
          switch (i++){
            case 0:
              assert.ok(Object.keys(_socket.clients).length == 1);
              assert.ok(msg == Object.keys(_socket.clients)[0]);
              assert.ok(_socket.clients[msg] instanceof HTMLFile);
              _socket.clients[msg].send('from server');
              post(client(_server), '/socket.io/htmlfile/' + msg + '/send', {data: encode('from client')});
              break;
            case 1:
              assert.ok(msg == 'from server');
              --trips || close();
          }
        });
      });
      
      _socket.on('connection', function(client){
        assert.ok(client instanceof HTMLFile);
        client.on('message', function(msg){
          assert.ok(msg == 'from client');
          --trips || close();
        });
      });
      
      function close(){
        _client.end();
        _server.close();
      };
    });
  },
  
  'test clients tracking': function(assert){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = get(_server, '/socket.io/htmlfile', assert, function(response){
        var once = false
        response.on('data', function(){
          if (!once){
            assert.ok(Object.keys(_socket.clients).length == 1);
            once = true;
            var _client2 = get(_server, '/socket.io/htmlfile', assert, function(response){
              response.on('data', function(){
                assert.ok(Object.keys(_socket.clients).length == 2);
                _client.end();
                _client2.end();
                _server.close();
              });
            });
          }
        });
      });
    });
  },
  
  'test buffered messages': function(assert){
    var _server = server()
      , _socket = socket(_server, { transportOptions: { 
        'htmlfile': {
          closeTimeout: 100
        }
      } });
      
    listen(_server, function(){
      var _client = get(_server, '/socket.io/htmlfile', assert, function(response){
        var once = false;
        response.on('data', function(data){
          if (!once){
            var sessid = decode(data);
            assert.ok(_socket.clients[sessid]._open === true);
            assert.ok(_socket.clients[sessid].connected);
            
            _socket.clients[sessid].connection.addListener('end', function(){
              assert.ok(_socket.clients[sessid]._open === false);
              assert.ok(_socket.clients[sessid].connected);
              
              _socket.clients[sessid].send('from server');
              
              _client = get(_server, '/socket.io/htmlfile/' + sessid, assert, function(response){
                response.on('data', function(data){
                  assert.ok(decode(data) == 'from server');
                  _client.end();
                  _server.close();
                });
              });
            });
            _client.end();
            once = true;
          }
        });
      });
    });
  },
  
  'test hearbeat timeout': function(assert){
    var _server = server()
      , _socket = socket(_server, {
          transportOptions: {
            'htmlfile': {
              timeout: 100,
              heartbeatInterval: 1
            }
          }
        });
    listen(_server, function(){
      var client = get(_server, '/socket.io/htmlfile', assert, function(response){
        var messages = 0;
        response.on('data', function(data){
          ++messages;
          var msg = decode(data);
          if (msg[0].substr(0, 3) == '~h~'){
            assert.ok(messages == 2);
            assert.ok(Object.keys(_socket.clients).length == 1);
            setTimeout(function(){
              assert.ok(Object.keys(_socket.clients).length == 0);
              client.end();
              _server.close();
            }, 150);
          }
        });
      });
    });
  }
  
};