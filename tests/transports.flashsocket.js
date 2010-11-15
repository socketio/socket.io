var io = require('socket.io')
  , net = require('net')
  , http = require('http')
  , querystring = require('querystring')
  , port = 7700;

require('socket.io/tests');

module.exports = {
  
  'test xml policy added to connection': function(assert){
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
