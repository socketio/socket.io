const EventEmitter = require("events");
const debug = require("debug")("engine:socket");

class Socket extends EventEmitter {
  /**
   * Client class (abstract).
   *
   * @api private
   */
  constructor(id, server, transport, req) {
    super();
    this.id = id;
    this.server = server;
    this.upgrading = false;
    this.upgraded = false;
    this.readyState = "opening";
    this.writeBuffer = [];
    this.packetsFn = [];
    this.sentCallbackFn = [];
    this.cleanupFn = [];
    this.request = req;

    // Cache IP since it might not be in the req later
    if (req.websocket && req.websocket._socket) {
      this.remoteAddress = req.websocket._socket.remoteAddress;
    } else {
      this.remoteAddress = req.connection.remoteAddress;
    }

    this.checkIntervalTimer = null;
    this.upgradeTimeoutTimer = null;
    this.pingTimeoutTimer = null;
    this.pingIntervalTimer = null;

    this.setTransport(transport);
    this.onOpen();
  }

  /**
   * Called upon transport considered open.
   *
   * @api private
   */
  onOpen() {
    this.readyState = "open";

    // sends an `open` packet
    this.transport.sid = this.id;
    this.sendPacket(
      "open",
      JSON.stringify({
        sid: this.id,
        upgrades: this.getAvailableUpgrades(),
        pingInterval: this.server.opts.pingInterval,
        pingTimeout: this.server.opts.pingTimeout
      })
    );

    if (this.server.opts.initialPacket) {
      this.sendPacket("message", this.server.opts.initialPacket);
    }

    this.emit("open");
    this.schedulePing();
  }

  /**
   * Called upon transport packet.
   *
   * @param {Object} packet
   * @api private
   */
  onPacket(packet) {
    if ("open" === this.readyState) {
      // export packet event
      debug("packet");
      this.emit("packet", packet);

      // Reset ping timeout on any packet, incoming data is a good sign of
      // other side's liveness
      this.resetPingTimeout(
        this.server.opts.pingInterval + this.server.opts.pingTimeout
      );

      switch (packet.type) {
        case "pong":
          debug("got pong");
          this.schedulePing();
          this.emit("heartbeat");
          break;

        case "error":
          this.onClose("parse error");
          break;

        case "message":
          this.emit("data", packet.data);
          this.emit("message", packet.data);
          break;
      }
    } else {
      debug("packet received with closed socket");
    }
  }

  /**
   * Called upon transport error.
   *
   * @param {Error} error object
   * @api private
   */
  onError(err) {
    debug("transport error");
    this.onClose("transport error", err);
  }

  /**
   * Pings client every `this.pingInterval` and expects response
   * within `this.pingTimeout` or closes connection.
   *
   * @api private
   */
  schedulePing() {
    clearTimeout(this.pingIntervalTimer);
    this.pingIntervalTimer = setTimeout(() => {
      debug(
        "writing ping packet - expecting pong within %sms",
        this.server.opts.pingTimeout
      );
      this.sendPacket("ping");
      this.resetPingTimeout(this.server.opts.pingTimeout);
    }, this.server.opts.pingInterval);
  }

  /**
   * Resets ping timeout.
   *
   * @api private
   */
  resetPingTimeout(timeout) {
    clearTimeout(this.pingTimeoutTimer);
    this.pingTimeoutTimer = setTimeout(() => {
      if (this.readyState === "closed") return;
      this.onClose("ping timeout");
    }, timeout);
  }

  /**
   * Attaches handlers for the given transport.
   *
   * @param {Transport} transport
   * @api private
   */
  setTransport(transport) {
    const onError = this.onError.bind(this);
    const onPacket = this.onPacket.bind(this);
    const flush = this.flush.bind(this);
    const onClose = this.onClose.bind(this, "transport close");

    this.transport = transport;
    this.transport.once("error", onError);
    this.transport.on("packet", onPacket);
    this.transport.on("drain", flush);
    this.transport.once("close", onClose);
    // this function will manage packet events (also message callbacks)
    this.setupSendCallback();

    this.cleanupFn.push(function() {
      transport.removeListener("error", onError);
      transport.removeListener("packet", onPacket);
      transport.removeListener("drain", flush);
      transport.removeListener("close", onClose);
    });
  }

  /**
   * Upgrades socket to the given transport
   *
   * @param {Transport} transport
   * @api private
   */
  maybeUpgrade(transport) {
    debug(
      'might upgrade socket transport from "%s" to "%s"',
      this.transport.name,
      transport.name
    );

    this.upgrading = true;

    const self = this;

    // set transport upgrade timer
    self.upgradeTimeoutTimer = setTimeout(function() {
      debug("client did not complete upgrade - closing transport");
      cleanup();
      if ("open" === transport.readyState) {
        transport.close();
      }
    }, this.server.opts.upgradeTimeout);

    function onPacket(packet) {
      if ("ping" === packet.type && "probe" === packet.data) {
        transport.send([{ type: "pong", data: "probe" }]);
        self.emit("upgrading", transport);
        clearInterval(self.checkIntervalTimer);
        self.checkIntervalTimer = setInterval(check, 100);
      } else if ("upgrade" === packet.type && self.readyState !== "closed") {
        debug("got upgrade packet - upgrading");
        cleanup();
        self.transport.discard();
        self.upgraded = true;
        self.clearTransport();
        self.setTransport(transport);
        self.emit("upgrade", transport);
        self.schedulePing();
        self.flush();
        if (self.readyState === "closing") {
          transport.close(function() {
            self.onClose("forced close");
          });
        }
      } else {
        cleanup();
        transport.close();
      }
    }

    // we force a polling cycle to ensure a fast upgrade
    function check() {
      if ("polling" === self.transport.name && self.transport.writable) {
        debug("writing a noop packet to polling for fast upgrade");
        self.transport.send([{ type: "noop" }]);
      }
    }

    function cleanup() {
      self.upgrading = false;

      clearInterval(self.checkIntervalTimer);
      self.checkIntervalTimer = null;

      clearTimeout(self.upgradeTimeoutTimer);
      self.upgradeTimeoutTimer = null;

      transport.removeListener("packet", onPacket);
      transport.removeListener("close", onTransportClose);
      transport.removeListener("error", onError);
      self.removeListener("close", onClose);
    }

    function onError(err) {
      debug("client did not complete upgrade - %s", err);
      cleanup();
      transport.close();
      transport = null;
    }

    function onTransportClose() {
      onError("transport closed");
    }

    function onClose() {
      onError("socket closed");
    }

    transport.on("packet", onPacket);
    transport.once("close", onTransportClose);
    transport.once("error", onError);

    self.once("close", onClose);
  }

  /**
   * Clears listeners and timers associated with current transport.
   *
   * @api private
   */
  clearTransport() {
    let cleanup;

    const toCleanUp = this.cleanupFn.length;

    for (let i = 0; i < toCleanUp; i++) {
      cleanup = this.cleanupFn.shift();
      cleanup();
    }

    // silence further transport errors and prevent uncaught exceptions
    this.transport.on("error", function() {
      debug("error triggered by discarded transport");
    });

    // ensure transport won't stay open
    this.transport.close();

    clearTimeout(this.pingTimeoutTimer);
  }

  /**
   * Called upon transport considered closed.
   * Possible reasons: `ping timeout`, `client error`, `parse error`,
   * `transport error`, `server close`, `transport close`
   */
  onClose(reason, description) {
    if ("closed" !== this.readyState) {
      this.readyState = "closed";

      // clear timers
      clearTimeout(this.pingIntervalTimer);
      clearTimeout(this.pingTimeoutTimer);

      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
      clearTimeout(this.upgradeTimeoutTimer);
      const self = this;
      // clean writeBuffer in next tick, so developers can still
      // grab the writeBuffer on 'close' event
      process.nextTick(function() {
        self.writeBuffer = [];
      });
      this.packetsFn = [];
      this.sentCallbackFn = [];
      this.clearTransport();
      this.emit("close", reason, description);
    }
  }

  /**
   * Setup and manage send callback
   *
   * @api private
   */
  setupSendCallback() {
    const self = this;
    this.transport.on("drain", onDrain);

    this.cleanupFn.push(function() {
      self.transport.removeListener("drain", onDrain);
    });

    // the message was sent successfully, execute the callback
    function onDrain() {
      if (self.sentCallbackFn.length > 0) {
        const seqFn = self.sentCallbackFn.splice(0, 1)[0];
        if ("function" === typeof seqFn) {
          debug("executing send callback");
          seqFn(self.transport);
        } else if (Array.isArray(seqFn)) {
          debug("executing batch send callback");
          const l = seqFn.length;
          let i = 0;
          for (; i < l; i++) {
            if ("function" === typeof seqFn[i]) {
              seqFn[i](self.transport);
            }
          }
        }
      }
    }
  }

  /**
   * Sends a message packet.
   *
   * @param {String} message
   * @param {Object} options
   * @param {Function} callback
   * @return {Socket} for chaining
   * @api public
   */
  send(data, options, callback) {
    this.sendPacket("message", data, options, callback);
    return this;
  }

  write(data, options, callback) {
    this.sendPacket("message", data, options, callback);
    return this;
  }

  /**
   * Sends a packet.
   *
   * @param {String} packet type
   * @param {String} optional, data
   * @param {Object} options
   * @api private
   */
  sendPacket(type, data, options, callback) {
    if ("function" === typeof options) {
      callback = options;
      options = null;
    }

    options = options || {};
    options.compress = false !== options.compress;

    if ("closing" !== this.readyState && "closed" !== this.readyState) {
      debug('sending packet "%s" (%s)', type, data);

      const packet = {
        type: type,
        options: options
      };
      if (data) packet.data = data;

      // exports packetCreate event
      this.emit("packetCreate", packet);

      this.writeBuffer.push(packet);

      // add send callback to object, if defined
      if (callback) this.packetsFn.push(callback);

      this.flush();
    }
  }

  /**
   * Attempts to flush the packets buffer.
   *
   * @api private
   */
  flush() {
    if (
      "closed" !== this.readyState &&
      this.transport.writable &&
      this.writeBuffer.length
    ) {
      debug("flushing buffer to transport");
      this.emit("flush", this.writeBuffer);
      this.server.emit("flush", this, this.writeBuffer);
      const wbuf = this.writeBuffer;
      this.writeBuffer = [];
      if (!this.transport.supportsFraming) {
        this.sentCallbackFn.push(this.packetsFn);
      } else {
        this.sentCallbackFn.push.apply(this.sentCallbackFn, this.packetsFn);
      }
      this.packetsFn = [];
      this.transport.send(wbuf);
      this.emit("drain");
      this.server.emit("drain", this);
    }
  }

  /**
   * Get available upgrades for this socket.
   *
   * @api private
   */
  getAvailableUpgrades() {
    const availableUpgrades = [];
    const allUpgrades = this.server.upgrades(this.transport.name);
    let i = 0;
    const l = allUpgrades.length;
    for (; i < l; ++i) {
      const upg = allUpgrades[i];
      if (this.server.opts.transports.indexOf(upg) !== -1) {
        availableUpgrades.push(upg);
      }
    }
    return availableUpgrades;
  }

  /**
   * Closes the socket and underlying transport.
   *
   * @param {Boolean} optional, discard
   * @return {Socket} for chaining
   * @api public
   */
  close(discard) {
    if ("open" !== this.readyState) return;

    this.readyState = "closing";

    if (this.writeBuffer.length) {
      this.once("drain", this.closeTransport.bind(this, discard));
      return;
    }

    this.closeTransport(discard);
  }

  /**
   * Closes the underlying transport.
   *
   * @param {Boolean} discard
   * @api private
   */
  closeTransport(discard) {
    if (discard) this.transport.discard();
    this.transport.close(this.onClose.bind(this, "forced close"));
  }
}

module.exports = Socket;
