import { Transport } from "../transport";
import debugModule from "debug";

const debug = debugModule("engine:webtransport");

const BINARY_HEADER = Buffer.of(54);

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

/**
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API
 */
export class WebTransport extends Transport {
  private readonly writer;

  constructor(private readonly session, stream, reader) {
    super({ _query: { EIO: "4" } });
    this.writer = stream.writable.getWriter();
    (async () => {
      let binaryFlag = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          debug("session is closed");
          break;
        }
        debug("received chunk: %o", value);
        if (!binaryFlag && value.byteLength === 1 && value[0] === 54) {
          binaryFlag = true;
          continue;
        }
        this.onPacket(
          this.parser.decodePacketFromBinary(value, binaryFlag, "nodebuffer")
        );
        binaryFlag = false;
      }
    })();

    session.closed.then(() => this.onClose());

    this.writable = true;
  }

  get name() {
    return "webtransport";
  }

  get supportsFraming() {
    return true;
  }

  send(packets) {
    this.writable = false;

    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      const isLast = i + 1 === packets.length;

      this.parser.encodePacketToBinary(packet, (data) => {
        if (shouldIncludeBinaryHeader(packet, data)) {
          debug("writing binary header");
          this.writer.write(BINARY_HEADER);
        }
        debug("writing chunk: %o", data);
        this.writer.write(data);
        if (isLast) {
          this.writable = true;
          this.emit("drain");
        }
      });
    }
  }

  doClose(fn) {
    debug("closing WebTransport session");
    this.session.close();
    fn && fn();
  }
}
