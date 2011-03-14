var io = require('socket.io')
  , http = require('http')
  , querystring = require('querystring')
  , assert = require('assert')
  , port = 7800
  , encode = require('socket.io/utils').encode
  , _decode = require('socket.io/utils').decode
  , EventEmitter = require('events').EventEmitter
  , eventsource = require('socket.io/transports/event-source');

// legacy server-send events: http://labs.opera.com/news/2006/09/01/
// HTML5 spec: http://dev.w3.org/html5/eventsource/

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

function get(client, url, legacy, callback){
  // decode the server response based on EventSource API
  function decode(response){
   var boundary = '\n'
     , queue = response.split(boundary)
     , data = ''
     , line
     , name = 'message'
     , lastEventId = 0
     , retry = 0;
     
    if(queue.length < 0 ) return;
   
    queue.reverse();
   
    while (queue.length > 0){
      line = queue.pop();
      var dataIndex = line.indexOf(':'), field = null, value = '';
      
      if (dataIndex == -1){
        field = line;
        value = '';
      } else if (dataIndex == 0){
        continue;
      } else {
        field = line.slice(0, dataIndex)
        value = line.slice(dataIndex+1)
      }
      
      if ((!legacy && field == 'event') || (legacy && field == 'Event')){
        name = value;
      }
      
      if (field == 'id'){
        lastEventId = value;
      }
      
      if (field == 'retry'){
        value = +value;
        if (!isNaN(value)){
          retry = value;
        }
      }
      
      if (field == 'data'){
        if (data.length > 0){
          data += "\n";
        }
        data += value;
      }
    }
    
    if (data.length > 0)
      return {
        lastEventId:lastEventId
      , data: data.replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '')
      , retry: retry
      , name: name
      }
    return;
  };
  
  
  var request = client.request('GET', url, {host: 'localhost'})
    , emitter = new EventEmitter
    , messages = 0;
  
  request.end();
  request.on('response', function(resp){
    callback(emitter);
    resp.on('data', function(data){
        emitter.emit('data', decode(''+data));
    });
  });
  
  client.end = function(){
    if (request.abort)
      request.abort();
    else
      request.connection.destroy();
  };

  return client;
};

function post(client, url, data, callback){
  var query = querystring.stringify(data)
    , request = client.request('POST', url, false, {'Content-Length': Buffer.byteLength(query)});
  request.write(query);
  request.end();
};

module.exports = {
  'test connection and handshake': function(){
    var _server = server()
      , _socket = socket(_server)
      , trips = 2
      , _client;

    listen(_server, function(){
      _socket.on('connection', function(client){
        assert.ok(client instanceof eventsource);
        client.on('message', function(msg){
          assert.ok(msg == 'from client');
          --trips || close();
        });
      });
      _client = get(client(_server), '/socket.io/event-source/', false, function(response){
        var i = 0;
        response.on('data', function(event){
          switch (i++){
              case 0:
                var sessid = _decode(event.data)[0];
              
                assert.ok(Object.keys(_socket.clients).length == 1);
                assert.ok(sessid == Object.keys(_socket.clients)[0]);
                assert.ok(_socket.clients[sessid] instanceof eventsource);
                _socket.clients[sessid].send('from server');
                post(client(_server), '/socket.io/event-source/' + sessid + '/send/', {data: encode('from client')});
                break;
              case 1:
                assert.ok(_decode(event.data)[0], 'from server');
                --trips || close();
            }
        });
      });
      function close(){
        _client.end();
        _server.close();
      };
    });
  },
  'test connection and handshake legacy connection': function(){
    var _server = server()
      , _socket = socket(_server)
      , trips = 2
      , _client;

    listen(_server, function(){
      _socket.on('connection', function(client){
        assert.ok(client instanceof eventsource);
        client.on('message', function(msg){
          assert.ok(msg == 'from client');
          --trips || close();
        });
      });
      _client = get(client(_server), '/socket.io/event-source/', true, function(response){
        var i = 0;
        response.on('data', function(event){
          switch (i++){
              case 0:
                var sessid = _decode(event.data)[0];
              
                assert.ok(Object.keys(_socket.clients).length == 1);
                assert.ok(sessid == Object.keys(_socket.clients)[0]);
                assert.ok(_socket.clients[sessid] instanceof eventsource);
                _socket.clients[sessid].send('from server');
                post(client(_server), '/socket.io/event-source/' + sessid + '/send/legacy/', {data: encode('from client')});
                break;
              case 1:
                assert.ok(_decode(event.data)[0], 'from server');
                --trips || close();
            }
        });
      });
      function close(){
        _client.end();
        _server.close();
      };
    });
  }
 
};
