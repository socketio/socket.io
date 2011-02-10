/**
 * Important note: this application is not suitable for benchmarks!
 */

var https = require('https')
  , url = require('url')
  , fs = require('fs')
  , io = require('../')
  , sys = require(process.binding('natives').util ? 'util' : 'sys')
  , server;
    
server = https.createServer({
    key: fs.readFileSync(__dirname + '/key.key')
  , cert: fs.readFileSync(__dirname + '/cert.crt')
}, function(req, res){
  // your normal server code
  var path = url.parse(req.url).pathname;
  switch (path){
    case '/':
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write('<h1>Welcome. Try the <a href="/chat-ssl.html">SSL Chat</a> example.</h1>');
      res.end();
      break;
      
    case '/json.js':
    case '/chat-ssl.html':
      fs.readFile(__dirname + path, function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
        res.write(data, 'utf8');
        res.end();
      });
      break;
      
    default: send404(res);
  }
}),

send404 = function(res){
  res.writeHead(404);
  res.write('404');
  res.end();
};

server.listen(443);

// socket.io, I choose you
// simplest chat application evar
var io = io.listen(server)
  , buffer = [];
  
io.on('connection', function(client){
  client.send({ buffer: buffer });
  client.broadcast({ announcement: client.sessionId + ' connected' });
  
  client.on('message', function(message){
    var msg = { message: [client.sessionId, message] };
    buffer.push(msg);
    if (buffer.length > 15) buffer.shift();
    client.broadcast(msg);
  });

  client.on('disconnect', function(){
    client.broadcast({ announcement: client.sessionId + ' disconnected' });
  });
});
