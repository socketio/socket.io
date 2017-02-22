
const server = require('http').createServer();
const io = require('socket.io')(server, {
  // serveClient: false // do not serve the client file, in that case the brfs loader is not needed
});
const port = process.env.PORT || 3000;

io.on('connect', onConnect);
server.listen(port, () => console.log('server listening on port ' + port));

function onConnect(socket){
  console.log('connect ' + socket.id);

  socket.on('disconnect', () => console.log('disconnect ' + socket.id));
}
