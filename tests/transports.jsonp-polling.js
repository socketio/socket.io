var io = require('socket.io')
  , http = require('http')
  , querystring = require('querystring')
  , assert = require('assert')
  , port = 7500
  , encode = require('socket.io/utils').encode
  , _decode = require('socket.io/utils').decode
  , Polling = require('socket.io/transports/jsonp-polling');

function decode(data){
  var io = {
    JSONP: [{
      '_': _decode
    }]
  };
  // the decode function simulates a browser executing the javascript jsonp call
  return eval(data);
};

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
    'jsonp-polling': {
      closeTimeout: 100
    }
  };
  return io.listen(server, options);
};

function get(client, url, callback){
  var request = client.request('GET', url + '/' + (+new Date) + '/0', {host: 'localhost'});
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
  
  'test connection and handshake': function(){
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
      get(client(_server), '/socket.io/jsonp-polling/', function(data){
        var sessid = decode(data);
        assert.ok(Object.keys(_socket.clients).length == 1);
        assert.ok(sessid == Object.keys(_socket.clients)[0]);
        assert.ok(_socket.clients[sessid] instanceof Polling);
        
        _socket.clients[sessid].send('from server');
        
        get(client(_server), '/socket.io/jsonp-polling/' + sessid, function(data){
          assert.ok(decode(data), 'from server');
          --trips || _server.close();
        });
        
        post(client(_server), '/socket.io/jsonp-polling/' + sessid + '/send//0', {data: encode('from client')});
      });
    });
  },
  
  'test clients tracking': function(){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      get(client(_server), '/socket.io/jsonp-polling/', function(){
        assert.ok(Object.keys(_socket.clients).length == 1);
        get(client(_server), '/socket.io/jsonp-polling/', function(){
          assert.ok(Object.keys(_socket.clients).length == 2);
          _server.close();
        });
      });
    });
  },
  
  'test buffered messages': function(){
    var _server = server()
      , _socket = socket(_server, { transportOptions: { 
        'jsonp-polling': {
          closeTimeout: 100,
          duration: 200
        }
      } });
      
    listen(_server, function(){
      get(client(_server), '/socket.io/jsonp-polling/', function(data){
        var sessid = decode(data);
        assert.ok(_socket.clients[sessid]._open === false);
        assert.ok(_socket.clients[sessid].connected);
        _socket.clients[sessid].send('from server');
        get(client(_server), '/socket.io/jsonp-polling/' + sessid, function(data){
          var durationCheck;
          assert.ok(decode(data) == 'from server');
          setTimeout(function(){
            assert.ok(_socket.clients[sessid]._open);
            assert.ok(_socket.clients[sessid].connected);
            durationCheck = true;
          }, 50);
          get(client(_server), '/socket.io/jsonp-polling/' + sessid, function(){
            assert.ok(durationCheck);
            _server.close();
          });
        });
      });
    });
  }
  
};
