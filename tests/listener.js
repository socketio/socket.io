var http = require('http')
  , net = require('net')
  , io = require('socket.io')
  , decode = require('socket.io/utils').decode
  , port = 7100
  , Listener = io.Listener
  , WebSocket = require('./../support/node-websocket-client/lib/websocket').WebSocket;

function server(callback){
  return http.createServer(callback || function(){});
};

function socket(server, options){
  if (!options) options = {};
  if (options.log === undefined) options.log = false;
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
  
  'test serving static javascript client': function(assert){
    var _server = server()
      , _socket = socket(_server);
    assert.response(_server
     , { url: '/socket.io/socket.io.js' }
     , { body: /setPath/, headers: { 'Content-Type': 'text/javascript' }});
    assert.response(_server
     , { url: '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf' }
     , { headers: { 'Content-Type': 'application/x-shockwave-flash' }}
     , function(resp){
       assert.type(resp.headers.etag, 'string');
       assert.response(_server
        , { url: '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf', headers: { 'If-None-Match': resp.headers.etag } }
        , { status: 304 });
     });
     assert.response(_server
      , { url: '/socket.io/WebSocketMain.swf' }
      , { headers: { 'Content-Type': 'application/x-shockwave-flash' }});
  },
  
  'test serving non-socket.io requests': function(assert){
    var _server = server()
      , _socket = socket(_server);
    _server.on('request', function(req, res){
      if (req.url == '/test'){
        res.writeHead(200);
        res.end('Hello world');
      }
    });
    assert.response(_server
     , { url: '/test' }
     , { body: 'Hello world' });
  },
  
  'test destroying an upgrade connection that is not WebSocket': function(assert){
    var _server = server()
      , _socket = socket(_server);
    listen(_server, function(){
      var client = http.createClient(_server._port)
        , request = client.request('/', {
            'Connection': 'Upgrade',
            'Upgrade': 'IRC'
          })
        , upgraded = false;
      client.addListener('upgrade', function(){
        upgraded = true;
      });
      client.addListener('end', function(){
        assert.ok(! upgraded);
        _server.close();
      })
      request.end();
    });
  },
  
  'test broadcasting to clients': function(assert){
    var _server = server()
      , _socket = socket(_server);
    listen(_server, function(){
      var _client1 = client(_server)
        , _client2 = client(_server)
        , trips = 2
        , expected = 2;
      
      _socket.on('connection', function(conn){
        --expected || _socket.broadcast('broadcasted msg');
      });
        
      function close(){
        _client1.close();
        _client2.close();
        _server.close();
      };
        
      _client1.onmessage = function(ev){
        if (!_client1._first){
          _client1._first = true;
        } else {
          assert.ok(decode(ev.data)[0] == 'broadcasted msg');
          --trips || close();
        }
      };
      _client2.onmessage = function(ev){
        if (!_client2._first){
          _client2._first = true;
        } else {
          assert.ok(decode(ev.data)[0] == 'broadcasted msg');
          --trips || close();
        }
      };
    })
  },
  
  'test connecting with an invalid sessionid': function(assert){
    var _server = server()
      , _socket = socket(_server);
    listen(_server, function(){
      var _client = client(_server, 'fake-session-id')
        , gotMessage = false;
      _client.onmessage = function(){
        gotMessage = true;
      };
      setTimeout(function(){
        assert.ok(!gotMessage);
        _server.close();
      }, 200);
    });
  },
  
  'test connecting to an invalid transport': function(assert){
    var _server = server(function(req, res){
          res.writeHead(200);
          res.end(req.url == '/socket.io/inexistent' ? 'All cool' : '');
        })
      , _socket = socket(_server);
    
    assert.response(_server, { url: '/socket.io/inexistent' }, { body: 'All cool' });
  }
  
};