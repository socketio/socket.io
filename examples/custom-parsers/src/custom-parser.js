
const Emitter = require('component-emitter');
const schemapack = require('schemapack');

/**
 * Packet types (see https://github.com/socketio/socket.io-protocol)
 */

const TYPES = {
  CONNECT: 0,
  DISCONNECT: 1,
  EVENT: 2,
  ACK: 3,
  ERROR: 4,
  BINARY_EVENT: 5,
  BINARY_ACK: 6
};

const stringSchema = schemapack.build({
  _id: 'uint8',
  data: [ 'string' ],
  nsp: 'string'
});

const numericSchema = schemapack.build({
  _id: 'uint8',
  data: [ 'uint16' ],
  nsp: 'string'
});

const binarySchema = schemapack.build({
  _id: 'uint8',
  data: 'buffer',
  nsp: 'string'
});

const errorPacket = {
  type: TYPES.ERROR,
  data: 'parser error'
};

class Encoder {
  encode (packet, callback) {
    switch (packet.type) {
      case TYPES.EVENT:
        return callback([ this.pack(packet) ]);
      default:
        return callback([ JSON.stringify(packet) ]);
    }
  }
  pack (packet) {
    let eventName = packet.data[0];
    let flatPacket = {
      data: packet.data[1],
      nsp: packet.nsp
    };
    switch (eventName) {
      case 'string':
        flatPacket._id = 1;
        return stringSchema.encode(flatPacket);
      case 'numeric':
        flatPacket._id = 2;
        return numericSchema.encode(flatPacket);
      case 'binary':
        flatPacket._id = 3;
        return binarySchema.encode(flatPacket);
      default:
        throw new Error('unknown event name: ' + eventName);
    }
  }
}

class Decoder extends Emitter {
  add (obj) {
    if (typeof obj === 'string') {
      this.parseJSON(obj);
    } else {
      this.parseBinary(obj);
    }
  }
  parseJSON (obj) {
    try {
      let decoded = JSON.parse(obj);
      this.emit('decoded', decoded);
    } catch (e) {
      this.emit('decoded', errorPacket);
    }
  }
  parseBinary (obj) {
    let view = new Uint8Array(obj);
    let packetId = view[0];
    try {
      let packet = {
        type: TYPES.EVENT
      };
      let decoded;
      switch (packetId) {
        case 1:
          decoded = stringSchema.decode(obj);
          packet.data = [ 'string', decoded.data ];
          packet.nsp = decoded.nsp;
          break;
        case 2:
          decoded = numericSchema.decode(obj);
          packet.data = [ 'numeric', decoded.data ];
          packet.nsp = decoded.nsp;
          break;
        case 3:
          decoded = binarySchema.decode(obj);
          packet.data = [ 'binary', decoded.data.buffer ];
          packet.nsp = decoded.nsp;
          break;
        default:
          throw new Error('unknown type');
      }
      this.emit('decoded', packet);
    } catch (e) {
      this.emit('decoded', errorPacket);
    }
  }
  destroy () {}
}

exports.Encoder = Encoder;
exports.Decoder = Decoder;
