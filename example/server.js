var http = require('http'), 
		url = require('url'),
		fs = require('fs'),
		io = require('../'),
		sys = require('sys'),
		
send404 = function(res){
	res.writeHead(404);
	res.write('404');
	res.end();
},
		
server = http.createServer(function(req, res){
	// your normal server code
	var path = url.parse(req.url).pathname;
	switch (path){
		case '/':
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.write('<h1>Welcome. Try the <a href="/chat.html">chat</a> example.</h1>');
			res.end();
			break;
			
		default:
			if (/\.(js|html|swf)$/.test(path)){
				try {
					var swf = path.substr(-4) === '.swf';
					res.writeHead(200, {'Content-Type': swf ? 'application/x-shockwave-flash' : ('text/' + (path.substr(-3) === '.js' ? 'javascript' : 'html'))});
					fs.readFile(__dirname + path, swf ? 'binary' : 'utf8', function(err, data){
						if (!err) res.write(data, swf ? 'binary' : 'utf8');
						res.end();
					});
				} catch(e){ 
					send404(res); 
				}
				break;
			}
		
			send404(res);
			break;
	}
});

server.listen(8080);
		
// socket.io, I choose you
// simplest chat application evar
var io = io.listen(server),
		buffer = [];
		
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