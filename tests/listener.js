var http = require('http')
  , io = require('socket.io')
  , port = 7100
  , Listener = io.Listener;

function server(){
  return http.createServer(function(){});
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

module.exports = {
  
  'test serving static javascript client': function(assert){
    var _server = server()
      , _socket = socket(_server);
    assert.response(_server
     , { url: '/socket.io/socket.io.js' }
     , { body: /setPath/, headers: { 'Content-Type': 'text/javascript' }});
    assert.response(_server
     , { url: '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf' }
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
  }
  
};