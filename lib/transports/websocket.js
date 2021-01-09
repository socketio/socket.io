const Transport = require("../transport");
const debug = require("debug")("engine:ws");

class WebSocket extends Transport {
  /**
   * WebSocket transport
   *
   * @param {http.IncomingMessage}
   * @api public
   */
  constructor(req) {
    super(req);
    this.socket = req.websocket;
    this.socket.on("message", this.onData.bind(this));
    this.socket.once("close", this.onClose.bind(this));
    this.socket.on("error", this.onError.bind(this));
    this.socket.on("headers", headers => {
      this.emit("headers", headers);
    });
    this.writable = true;
    this.perMessageDeflate = null;
  }

  /**
   * Transport name
   *
   * @api public
   */
  get name() {
    return "websocket";
  }

  /**
   * Advertise upgrade support.
   *
   * @api public
   */
  get handlesUpgrades() {
    return true;
  }

  /**
   * Advertise framing support.
   *
   * @api public
   */
  get supportsFraming() {
    return true;
  }

  /**
   * Processes the incoming data.
   *
   * @param {String} encoded packet
   * @api private
   */
  onData(data) {
    debug('received "%s"', data);
    super.onData(data);
  }

  /**
   * Writes a packet payload.
   *
   * @param {Array} packets
   * @api private
   */
  send(packets) {
    var self = this;

    for (var i = 0; i < packets.length; i++) {
      var packet = packets[i];
      this.parser.encodePacket(packet, self.supportsBinary, send);
    }

    function send(data) {
      debug('writing "%s"', data);

      // always creates a new object since ws modifies it
      var opts = {};
      if (packet.options) {
        opts.compress = packet.options.compress;
      }

      if (self.perMessageDeflate) {
        var len =
          "string" === typeof data ? Buffer.byteLength(data) : data.length;
        if (len < self.perMessageDeflate.threshold) {
          opts.compress = false;
        }
      }

      self.writable = false;
      self.socket.send(data, opts, onEnd);
    }

    function onEnd(err) {
      if (err) return self.onError("write error", err.stack);
      self.writable = true;
      self.emit("drain");
    }
  }

  /**
   * Closes the transport.
   *
   * @api private
   */
  doClose(fn) {
    debug("closing");
    this.socket.close();
    fn && fn();
  }
}

module.exports = WebSocket;
