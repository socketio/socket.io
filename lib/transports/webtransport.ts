import { Transport } from "../transport.js";
import { nextTick } from "./websocket-constructor.js";
import {
  encodePacketToBinary,
  decodePacketFromBinary,
  Packet,
} from "engine.io-parser";
import debugModule from "debug"; // debug()

const debug = debugModule("engine.io-client:webtransport"); // debug()

function shouldIncludeBinaryHeader(packet, encoded) {
  // 48 === "0".charCodeAt(0) (OPEN packet type)
  // 54 === "6".charCodeAt(0) (NOOP packet type)
  return (
    packet.type === "message" &&
    typeof packet.data !== "string" &&
    encoded[0] >= 48 &&
    encoded[0] <= 54
  );
}

export class WT extends Transport {
  private transport: any;
  private writer: any;

  get name() {
    return "webtransport";
  }

  protected doOpen() {
    // @ts-ignore
    if (typeof WebTransport !== "function") {
      return;
    }
    // @ts-ignore
    this.transport = new WebTransport(
      this.uri("https"),
      this.opts.transportOptions[this.name]
    );

    this.transport.closed.then(() => this.onClose());

    // note: we could have used async/await, but that would require some additional polyfills
    this.transport.ready.then(() => {
      this.transport.createBidirectionalStream().then((stream) => {
        const reader = stream.readable.getReader();
        this.writer = stream.writable.getWriter();

        let binaryFlag;

        const read = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              debug("session is closed");
              return;
            }
            debug("received chunk: %o", value);
            if (!binaryFlag && value.byteLength === 1 && value[0] === 54) {
              binaryFlag = true;
            } else {
              // TODO expose binarytype
              this.onPacket(
                decodePacketFromBinary(value, binaryFlag, "arraybuffer")
              );
              binaryFlag = false;
            }
            read();
          });
        };

        read();

        const handshake = this.query.sid ? `0{"sid":"${this.query.sid}"}` : "0";
        this.writer
          .write(new TextEncoder().encode(handshake))
          .then(() => this.onOpen());
      });
    });
  }

  protected write(packets: Packet[]) {
    this.writable = false;

    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const lastPacket = i === packets.length - 1;

      encodePacketToBinary(packet, (data) => {
        if (shouldIncludeBinaryHeader(packet, data)) {
          debug("writing binary header");
          this.writer.write(Uint8Array.of(54));
        }
        debug("writing chunk: %o", data);
        this.writer.write(data).then(() => {
          if (lastPacket) {
            nextTick(() => {
              this.writable = true;
              this.emitReserved("drain");
            }, this.setTimeoutFn);
          }
        });
      });
    }
  }

  protected doClose() {
    this.transport?.close();
  }
}
