// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('../..')(server);
var port = process.env.PORT || 3000;
server.listen(port, function () {
console.log('Server listening at port %d', port);
});
// Routing

app.use(express.static(__dirname + '/public'));


// Chatroom
io.on('connection', function (socket) {
// when the client emits instructions, this listens and executes
	socket.on('line', function (data) {
		io.emit('line',data);

	});
	socket.on('circle', function (data) {
// we tell the client to execute 'new message'
		var b=JSON.parse(data);
		io.emit('circle',data);

	});
	socket.on('polygon', function (data) {
// we tell the client to execute 'new message'
		var b=JSON.parse(data);
		io.emit('polygon',data);

	});
});

