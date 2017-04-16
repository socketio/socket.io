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

// when the client emits instructions, this listens and executes
io.on('connection', function (socket) {
	//Line
	socket.on('line', function (data) {
		io.emit('line',data);
	});
	//Fill or empty
	socket.on('fill',function(data){
		io.emit('fill',data);
	});
	//Circle
	socket.on('circle', function (data) {
		io.emit('circle',data);

	});
	//Polygon
	socket.on('polygon', function (data) {
		io.emit('polygon',data);

	});
});
