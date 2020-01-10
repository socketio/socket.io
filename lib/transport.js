const parser = require('engine.io-parser');
const Emitter = require('component-emitter');

class Transport extends Emitter {
  /**
   * Transport abstract constructor.
   *
   * @param {Object} options.
   * @api private
   */
  constructor (opts) {
    super();

    this.path = opts.path;
    this.hostname = opts.hostname;
    this.port = opts.port;
    this.secure = opts.secure;
    this.query = opts.query;
    this.timestampParam = opts.timestampParam;
    this.timestampRequests = opts.timestampRequests;
    this.readyState = '';
    this.agent = opts.agent || false;
    this.socket = opts.socket;
    this.enablesXDR = opts.enablesXDR;
    this.withCredentials = opts.withCredentials;

    // SSL options for Node.js client
    this.pfx = opts.pfx;
    this.key = opts.key;
    this.passphrase = opts.passphrase;
    this.cert = opts.cert;
    this.ca = opts.ca;
    this.ciphers = opts.ciphers;
    this.rejectUnauthorized = opts.rejectUnauthorized;
    this.forceNode = opts.forceNode;

    // results of ReactNative environment detection
    this.isReactNative = opts.isReactNative;

    // other options for Node.js client
    this.extraHeaders = opts.extraHeaders;
    this.localAddress = opts.localAddress;
  }

  /**
   * Emits an error.
   *
   * @param {String} str
   * @return {Transport} for chaining
   * @api public
   */
  onError (msg, desc) {
    const err = new Error(msg);
    err.type = 'TransportError';
    err.description = desc;
    this.emit('error', err);
    return this;
  }

  /**
   * Opens the transport.
   *
   * @api public
   */
  open () {
    if ('closed' === this.readyState || '' === this.readyState) {
      this.readyState = 'opening';
      this.doOpen();
    }

    return this;
  }

  /**
   * Closes the transport.
   *
   * @api private
   */
  close () {
    if ('opening' === this.readyState || 'open' === this.readyState) {
      this.doClose();
      this.onClose();
    }

    return this;
  }

  /**
   * Sends multiple packets.
   *
   * @param {Array} packets
   * @api private
   */
  send (packets) {
    if ('open' === this.readyState) {
      this.write(packets);
    } else {
      throw new Error('Transport not open');
    }
  }

  /**
   * Called upon open
   *
   * @api private
   */
  onOpen () {
    this.readyState = 'open';
    this.writable = true;
    this.emit('open');
  }

  /**
   * Called with data.
   *
   * @param {String} data
   * @api private
   */
  onData (data) {
    const packet = parser.decodePacket(data, this.socket.binaryType);
    this.onPacket(packet);
  }

  /**
   * Called with a decoded packet.
   */
  onPacket (packet) {
    this.emit('packet', packet);
  }

  /**
   * Called upon close.
   *
   * @api private
   */
  onClose () {
    this.readyState = 'closed';
    this.emit('close');
  }
}

module.exports = Transport;
