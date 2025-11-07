// imported from the 'socket.io-adapter' package
export enum MessageType {
  INITIAL_HEARTBEAT = 1,
  HEARTBEAT,
  BROADCAST,
  SOCKETS_JOIN,
  SOCKETS_LEAVE,
  DISCONNECT_SOCKETS,
  FETCH_SOCKETS,
  FETCH_SOCKETS_RESPONSE,
  SERVER_SIDE_EMIT,
  SERVER_SIDE_EMIT_RESPONSE,
  BROADCAST_CLIENT_COUNT,
  BROADCAST_ACK,
  ADAPTER_CLOSE,
}

export type ServerId = string;

export type ClusterMessage = {
  uid: ServerId;
  nsp: string;
} & (
  | {
      type:
        | MessageType.INITIAL_HEARTBEAT
        | MessageType.HEARTBEAT
        | MessageType.ADAPTER_CLOSE;
    }
  | {
      type: MessageType.BROADCAST;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        packet: unknown;
        requestId?: string;
      };
    }
  | {
      type: MessageType.SOCKETS_JOIN | MessageType.SOCKETS_LEAVE;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        rooms: string[];
      };
    }
  | {
      type: MessageType.DISCONNECT_SOCKETS;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        close?: boolean;
      };
    }
  | {
      type: MessageType.FETCH_SOCKETS;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        requestId: string;
      };
    }
  | {
      type: MessageType.SERVER_SIDE_EMIT;
      data: {
        requestId?: string;
        packet: any[];
      };
    }
);

export interface BroadcastFlags {
  volatile?: boolean;
  compress?: boolean;
  local?: boolean;
  broadcast?: boolean;
  binary?: boolean;
  timeout?: number;
}
