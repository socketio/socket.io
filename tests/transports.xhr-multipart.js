var io = require('socket.io')
  , net = require('net')
  , http = require('http')
  , assert = require('assert')
  , querystring = require('querystring')
  , port = 7300
  , encode = require('socket.io/utils').encode
  , decode = require('socket.io/utils').decode
  , EventEmitter = require('events').EventEmitter
  , Multipart = require('socket.io/transports/xhr-multipart');
  
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
    'xhr-multipart': {
      // disable heartbeats for tests, re-enabled in heartbeat test below
      timeout: null 
    }
  };
  return io.listen(server, options);
};

function get(server, url, callback){
  var client = net.createConnection(server._port);
  client.on('connect', function(){
    client.write('GET ' + url + " HTTP/1.1\r\n\r\n");
    
    var resp = new EventEmitter()
      , buffer = '';
    
    callback(resp);
    client.on('data', function(_data){
      var data = _data.toString()
        , i = 0
        , l = data.length;
        
      while (i < l){
        // lookahead for the `--socketio\n` boundary
        if (data.charAt(i) == '-' && data.substr(i, 11) == "--socketio\n"){
          // header filtering
          var filtered = buffer.replace(/[A-Z][^\n]+\r?\n?\n/gm, '')
                               .replace(/^\r\n$/, '')
                               .replace(/\n$/, '');
          if (filtered !== '') resp.emit('data', filtered);
          buffer = '';
          i = i + 11;
        } else {
          buffer += data.charAt(i);
          i++;
        }
      }
    });
  });
  return client;
};

function post(client, url, data, callback){
  var query = querystring.stringify(data)
    , request = client.request('POST', url, {'Content-Length': Buffer.byteLength(query)});
  request.write(query);
  request.end();
};

module.exports = {
  
  'test connection and handshake': function(){
    var _server = server()
      , _socket = socket(_server)
      , trips = 2;

    listen(_server, function(){
      var _client = get(_server, '/socket.io/xhr-multipart', function(response){
        var i = 0;
        response.on('data', function(data){
          var msg = decode(data);
          switch (i++){
            case 0:
              assert.ok(Object.keys(_socket.clients).length == 1);
              assert.ok(msg == Object.keys(_socket.clients)[0]);
              assert.ok(_socket.clients[msg] instanceof Multipart);
              _socket.clients[msg].send('from server');
              post(client(_server), '/socket.io/xhr-multipart/' + msg + '/send', {data: encode('from client')});
              break;
            case 1:
              assert.ok(msg == 'from server');
              --trips || close();
          }
        });
      });
      
      _socket.on('connection', function(client){
        assert.ok(client instanceof Multipart);
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
  
  'test clients tracking': function(){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = get(_server, '/socket.io/xhr-multipart', function(response){
        var once = false
        response.on('data', function(){
          if (!once){
            assert.ok(Object.keys(_socket.clients).length == 1);
            once = true;
            var _client2 = get(_server, '/socket.io/xhr-multipart', function(response){
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
  
  'test buffered messages': function(){
    var _server = server()
      , _socket = socket(_server, { transportOptions: { 
        'xhr-multipart': {
          closeTimeout: 100
        }
      } });
      
    listen(_server, function(){
      var _client = get(_server, '/socket.io/xhr-multipart', function(response){
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
              
              _client = get(_server, '/socket.io/xhr-multipart/' + sessid, function(response){
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
  
  'test hearbeat timeout': function(){
    var _server = server()
      , _socket = socket(_server, {
          transportOptions: {
            'xhr-multipart': {
              timeout: 100,
              heartbeatInterval: 1
            }
          }
        });
    listen(_server, function(){
      var client = get(_server, '/socket.io/xhr-multipart', function(response){
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
