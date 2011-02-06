var io = require('socket.io')
  , net = require('net')
  , http = require('http')
  , assert = require('assert')
  , querystring = require('querystring')
  , port = 7700
  , encode = require('socket.io/utils').encode
  , decode = require('socket.io/utils').decode;

function server(callback){
  return http.createServer(function(){});
};

function socket(server, options){
  if (!options) options = {};
  options.log = false;
  if (!options.transportOptions) options.transportOptions = { 
    'flashsocket': {
      // disable heartbeats for tests, re-enabled in heartbeat test below
      timeout: null 
    }
  };
  return io.listen(server, options);
};

function listen(s, callback){
  s._port = port;
  s.listen(port, callback);
  port++;
  return s;
};

module.exports = {
  
  'test xml policy added to connection': function(){
    var _server = server()
      , _socket = socket(_server);
    listen(_server, function(){
      var conn = net.createConnection(_server._port);
      conn.write('<policy-file-request/>\0');
      conn.on('data', function(data){
        assert.ok(data.toString().indexOf('<allow-access-from domain="*" to-ports="*"/>') !== -1);
        conn.destroy();
        _server.close();
      });
    });
  }
  
}
