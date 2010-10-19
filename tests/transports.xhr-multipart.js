var io = require('socket.io')
  , http = require('http')
  , querystring = require('querystring')
  , port = 10000
  , encode = require('socket.io/utils').encode
  , decode = require('socket.io/utils').decode
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
  return io.listen(server, options);
};

function post(client, url, data, callback){
  var query = querystring.stringify(data)
    , request = client.request('POST', url, {'Content-Length': Buffer.byteLength(query)});
  request.write(query);
  request.end();
};

