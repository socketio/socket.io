var io = require('socket.io')
  , http = require('http')
  , querystring = require('querystring')
  , port = 9000
  , encode = require('socket.io/utils').encode
  , decode = require('socket.io/utils').decode
  , Polling = require('socket.io/transports/xhr-polling');

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
  return io.listen(server, options);
};

function get(client, url, callback){
  var request = client.request('GET', url, {host: 'localhost'});
  request.end();
  request.on('response', function(response){
    var data = '';
    response.setEncoding('utf8');
    response.on('data', function(chunk){
      data += chunk;
    });
    response.on('end', function(chunk){
      callback(data);
    });
  });
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

    _socket.on('connection', function(client){
      assert.ok(client instanceof Polling);
      client.on('message', function(msg){
        assert.ok(msg == 'from client');
        --trips || _server.close();
      });
    });

    listen(_server, function(){
      get(client(_server), '/socket.io/xhr-polling', function(data){
        var sessid = decode(data);
        assert.ok(Object.keys(_socket.clients).length == 1);
        assert.ok(sessid == Object.keys(_socket.clients)[0]);
        assert.ok(_socket.clients[sessid] instanceof Polling);
        
        _socket.clients[sessid].send('from server');
        
        get(client(_server), '/socket.io/xhr-polling/' + sessid, function(data){
          assert.ok(decode(data), 'from server');
          --trips || _server.close();
        });
        
        post(client(_server), '/socket.io/xhr-polling/' + sessid + '/send', {data: encode('from client')});
      });
    });
  }
  
};