import { Server } from 'socket.io';

const io = new Server();

io.on('connection', (socket) => {
  console.log(`connect: ${socket.id}`, socket.request.headers);

  socket.on('disconnect', () => {
    console.log(`disconnect: ${socket.id}`);
  });
});

io.listen(3000);
