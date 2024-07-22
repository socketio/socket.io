import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({})
export class EventsGateway {
  @WebSocketServer()
  io: Server;

  @SubscribeMessage('hello')
  handleEvent(@MessageBody() data: string): string {
    return data.split('').reverse().join('');
  }
}
