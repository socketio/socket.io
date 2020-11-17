const io = require('socket.io')();

io.on('connection', socket => {
  console.log(`connect: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`disconnect: ${socket.id}`);
  });
});

io.listen(3000, {
  cors: {
    origin: ["http://localhost:19006"]
  }
});

setInterval(() => {
  io.emit('message', new Date().toISOString());
}, 1000);
