import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Socket } from './src/socket';

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
  res.sendFile('index.html', { root: __dirname });
});

const httpServer = createServer(app);

const socket = new Socket(httpServer);
const space = socket.createNamespace('sessions');

socket.onConnect(space, (s) => {
  const room = 'room_' + s.handshake.auth.room;
  socket.joinRoom(room, s);
  socket.emitToRoomInSpace('connect_msg', space, room, { test: 'test', room: s.handshake.auth.room });
});

httpServer.listen(3000);
