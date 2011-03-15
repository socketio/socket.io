/**
 * Test dependencies
 */
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
  /**
   * Decodes the EventSource response that we receive from the
   * server in to a readable JavaScript object / data message.
   *
   * @param {String} response The response from the server
   * @returns {Object} The event / message
   */
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
      , name: name.replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '')
      }
    return;
  };
  
  
  var request = client.request('GET', url + (legacy ? '/legacy/' : ''), {host: 'localhost'})
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
  /**
   * Test if we can connect succesfully and send and understand the messages
   * that we receive from the server.
   */
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
  
  /**
   * Check if we can connect using the old specification of the EventSource.
   */
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
  },
  
  /**
   * Test if we send the correct content-type for the EventSource.
   */
  'test correct content-type': function(){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = client(_server)
        , req = _client.request('get', '/socket.io/event-source/', {host: 'localhost'});
      
      req.end();
      req.on('response', function(resp){
        assert.equal(resp.headers['content-type'], 'text/event-stream', 'event-stream header');
        assert.equal(resp.headers['connection'], 'keep-alive', 'keep alive');
        req.abort && req.abort();
        req.connection && req.connection.destroy();
        _server.close();
      })
      
    });
  },
  
  /**
   * The legacy implementation of Opera 8 requires a different header than
   * the one that is currently specified in the HTML5 specification. If we
   * send the incorrect content-type, the EventSource transport will not be able
   * to connect to the server.
   */
  'test correct content-type legacy': function(){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = client(_server)
        , req = _client.request('get', '/socket.io/event-source//legacy', {host: 'localhost'});
      
      req.end();
      req.on('response', function(resp){
        assert.ok(resp.headers['content-type'], 'application/x-dom-event-stream', 'x-dom-event-stream header');
        assert.ok(resp.headers['connection'], 'keep-alive');
        req.abort && req.abort();
        req.connection && req.connection.destroy();
        _server.close();
      });
      
    });
  },
  
  /**
   * The legacy implementation of Opera 8 requires the data stream to be added
   * in a Event: namespace. So we can actually read it out :).
   */
  'test event namespace legacy': function(){
    var _server = server()
      , _socket = socket(_server)
      , trips = 2
      , _client;

    listen(_server, function(){
      _client = get(client(_server), '/socket.io/event-source/', true, function(response){
        response.on('data', function(event){
          assert.equal(event.name, 'io', 'use the IO event for messages');
          close();
          
        });
      });
      function close(){
        _client.end();
        _server.close();
      };
    });
  },
  
  /**
   * Test if multiple clients are handled okay.
   */
  'test clients tracking': function(){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = get(client(_server), '/socket.io/event-source/', false, function(response){
        var once = false;
        response.on('data', function(event){
          if(!once){
            assert.ok(Object.keys(_socket.clients).length == 1);
            once = true;
            var _client2 = get(client(_server), '/socket.io/event-source/', false, function(response){
              response.on('data',function(){
                assert.ok(Object.keys(_socket.clients).length == 2);
                _client.end();
                _client2.end();
                _server.close();
              })
            });
          }
        })
      })
    })
  },
  
  /**
   * Test if multiple clients are handled okay on the legacy connection.
   */
  'test clients tracking legacy': function(){
    var _server = server()
      , _socket = socket(_server);
    
    listen(_server, function(){
      var _client = get(client(_server), '/socket.io/event-source/', true, function(response){
        var once = false;
        response.on('data', function(event){
          if(!once){
            assert.ok(Object.keys(_socket.clients).length == 1);
            once = true;
            var _client2 = get(client(_server), '/socket.io/event-source/', true, function(response){
              response.on('data',function(){
                assert.ok(Object.keys(_socket.clients).length == 2);
                _client.end();
                _client2.end();
                _server.close();
              })
            });
          }
        })
      })
    })
  }
};