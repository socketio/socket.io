
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
 
/**
 * Module requirements.
 */

var Transport = require('../../transport')
  , EventEmitter = process.EventEmitter
  , crypto = require('crypto')
  , parser = require('../../parser')
  , util = require('../../util');

/**
 * Export the constructor.
 */

exports = module.exports = WebSocket;
exports.Parser = Parser;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function WebSocket (mng, data, req) {
  // parser
  var self = this;

  this.parser = new Parser();
  this.parser.on('data', function (packet) {
    self.onMessage(parser.decodePacket(packet));
  });
  this.parser.on('ping', function () {
    // version 8 ping => pong
    this.socket.write('\u008a\u0000');
  });
  this.parser.on('close', function () {
    self.end();
  });
  this.parser.on('error', function () {
    self.end();
  });

  Transport.call(this, mng, data, req);
};

/**
 * Inherits from Transport.
 */

WebSocket.prototype.__proto__ = Transport.prototype;

/**
 * Transport name
 *
 * @api public
 */

WebSocket.prototype.name = 'websocket';

/**
 * Called when the socket connects.
 *
 * @api private
 */

WebSocket.prototype.onSocketConnect = function () {
  var self = this;

  if (this.req.headers.upgrade !== 'websocket') {
    this.log.warn(this.name + ' connection invalid');
    this.end();
    return;
  }

  var origin = this.req.headers.origin
    , location = (this.socket.encrypted ? 'wss' : 'ws')
               + '://' + this.req.headers.host + this.req.url;

  if (!this.req.headers['sec-websocket-key']) {
    this.log.warn(this.name + ' connection invalid: received no key');
    this.end();
    return;
  }
    
  // calc key
  var key = this.req.headers['sec-websocket-key'];  
  var shasum = crypto.createHash('sha1');  
  shasum.update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");  
  key = shasum.digest('base64');

  var headers = [
      'HTTP/1.1 101 Switching Protocols'
    , 'Upgrade: websocket'
    , 'Connection: Upgrade'
    , 'Sec-WebSocket-Accept: ' + key
  ];

  try {
    this.socket.write(headers.concat('', '').join('\r\n'));
    this.socket.setTimeout(0);
    this.socket.setNoDelay(true);
  } catch (e) {
    this.end();
    return;
  }

  this.socket.on('data', function (data) {
    self.parser.add(data);
  });
};

/**
 * Writes to the socket.
 *
 * @api private
 */

WebSocket.prototype.write = function (data) {
  if (this.open) {
    var buf = this.frame(0x81, data);
    this.socket.write(buf, 'binary');
    this.log.debug(this.name + ' writing', data);
  }
};

/**
 * Frame server-to-client output as a text packet.
 *
 * @api private
 */

WebSocket.prototype.frame = function (opcode, data) {
  var startOffset = 2, secondByte = data.length, buf;
  if (data.length > 125) {
    // opcode = 0x81;
    startOffset += 2;
    secondByte = 126;
  }
  if (data.length > 65536) {
    startOffset += 6;
    secondByte = 127;
  }
  buf = new Buffer(data.length + startOffset, 'utf8');
  buf[0] = opcode;
  buf[1] = secondByte;
  switch (secondByte) {
  case 126:
    buf[2] = data.length >>> 8;
    buf[3] = data.length % 256;
    break;
  case 127:
    for (var i = 6; i > 2; i--) {
      buf[i] = secondByte % 256;
      secondByte >>>= 8;
    }
  }
  buf.write(data, startOffset, 'utf8');
  return buf;
};

/**
 * Closes the connection.
 *
 * @api private
 */

WebSocket.prototype.doClose = function () {
  this.socket.end();
};

/**
 * WebSocket parser
 *
 * @api public
 */
 
function Parser () {
  this.state = {
    activeFragmentedOperation: null,
    lastFragment: false,
    masked: false,
    opcode: 0
  };
  this.overflow = null;
  this.expectOffset = 0;
  this.expectBuffer = null;
  this.expectHandler = null;
  this.currentMessage = '';

  var self = this;  
  this.opcodeHandlers = {
    // text
    '1': function(data) {
      var finish = function(mask, data) {
        self.currentMessage += self.unmask(mask, data);
        if (self.state.lastFragment) {
          self.emit('data', self.currentMessage);
          self.currentMessage = '';
        }
        self.endPacket();
      }

      var expectData = function(length) {
        if (self.state.masked) {
          self.expect('Mask', 4, function(data) {
            var mask = data;
            self.expect('Data', length, function(data) {
              finish(mask, data);
            });
          });
        }
        else {
          self.expect('Data', length, function(data) { 
            finish(null, data);
          });
        } 
      }

      // decode length
      var firstLength = data[1] & 0x7f;
      if (firstLength < 126) {
        expectData(firstLength);
      }
      else if (firstLength == 126) {
        self.expect('Length', 2, function(data) {
          expectData(util.unpack(data));
        });
      }
      else if (firstLength == 127) {
        self.expect('Length', 8, function(data) {
          if (util.unpack(data.slice(0, 4)) != 0) {
            self.error('packets with length spanning more than 32 bit is currently not supported');
            return;
          }
          var lengthBytes = data.slice(4); // note: cap to 32 bit length
          expectData(util.unpack(data));
        });
      }      
    },
    // close
    '8': function(data) {
      self.emit('close');
      self.reset();
    },
    // ping
    '9': function(data) {
      if (self.state.lastFragment == false) {
        self.error('fragmented ping is not supported');
        return;
      }
      
      var finish = function(mask, data) {
        self.emit('ping', self.unmask(mask, data));
        self.endPacket();
      }

      var expectData = function(length) {
        if (self.state.masked) {
          self.expect('Mask', 4, function(data) {
            var mask = data;
            self.expect('Data', length, function(data) {
              finish(mask, data);
            });
          });
        }
        else {
          self.expect('Data', length, function(data) { 
            finish(null, data);
          });
        } 
      }

      // decode length
      var firstLength = data[1] & 0x7f;
      if (firstLength == 0) {
        finish(null, null);        
      }
      else if (firstLength < 126) {
        expectData(firstLength);
      }
      else if (firstLength == 126) {
        self.expect('Length', 2, function(data) {
          expectData(util.unpack(data));
        });
      }
      else if (firstLength == 127) {
        self.expect('Length', 8, function(data) {
          expectData(util.unpack(data));
        });
      }      
    }
  }

  this.expect('Opcode', 2, this.processPacket);  
};

/**
 * Inherits from EventEmitter.
 */

Parser.prototype.__proto__ = EventEmitter.prototype;

/**
 * Add new data to the parser.
 *
 * @api public
 */

Parser.prototype.add = function(data) {
  if (this.expectBuffer == null) {
    this.addToOverflow(data);
    return;
  }
  var toRead = Math.min(data.length, this.expectBuffer.length - this.expectOffset);
  data.copy(this.expectBuffer, this.expectOffset, 0, toRead);
  this.expectOffset += toRead;
  if (toRead < data.length) {
    // at this point the overflow buffer shouldn't at all exist
    this.overflow = new Buffer(data.length - toRead);
    data.copy(this.overflow, 0, toRead, toRead + this.overflow.length);
  }
  if (this.expectOffset == this.expectBuffer.length) {
    var bufferForHandler = this.expectBuffer;
    this.expectBuffer = null;
    this.expectOffset = 0;
    this.expectHandler.call(this, bufferForHandler);
  }
}

/**
 * Adds a piece of data to the overflow.
 *
 * @api private
 */

Parser.prototype.addToOverflow = function(data) {
  if (this.overflow == null) this.overflow = data;
  else {
    var prevOverflow = this.overflow;
    this.overflow = new Buffer(this.overflow.length + data.length);
    prevOverflow.copy(this.overflow, 0);
    data.copy(this.overflow, prevOverflow.length);
  }  
}

/**
 * Waits for a certain amount of bytes to be available, then fires a callback.
 *
 * @api private
 */

Parser.prototype.expect = function(what, length, handler) {
  this.expectBuffer = new Buffer(length);
  this.expectOffset = 0;
  this.expectHandler = handler;
  if (this.overflow != null) {
    var toOverflow = this.overflow;
    this.overflow = null;
    this.add(toOverflow);
  }
}

/**
 * Start processing a new packet.
 *
 * @api private
 */

Parser.prototype.processPacket = function (data) {
  if ((data[0] & 0x70) != 0) this.error('reserved fields not empty');
  this.state.lastFragment = (data[0] & 0x80) == 0x80; 
  this.state.masked = (data[1] & 0x80) == 0x80;
  var opcode = data[0] & 0xf;
  if (opcode == 0) {
    // continuation frame
    if (this.state.opcode != 1 || this.state.opcode != 2) {
      this.error('continuation frame cannot follow current opcode')
      return;
    }
  }
  else this.state.opcode = opcode;
  this.state.opcode = data[0] & 0xf;
  var handler = this.opcodeHandlers[this.state.opcode];
  if (typeof handler == 'undefined') this.error('no handler for opcode ' + this.state.opcode);
  else handler(data);
}

/**
 * Endprocessing a packet.
 *
 * @api private
 */

Parser.prototype.endPacket = function() {
  this.expectOffset = 0;
  this.expectBuffer = null;
  this.expectHandler = null;
  if (this.state.lastFragment && this.state.opcode == this.state.activeFragmentedOperation) {
    // end current fragmented operation
    this.state.activeFragmentedOperation = null;
  }
  this.state.lastFragment = false;
  this.state.opcode = this.state.activeFragmentedOperation != null ? this.state.activeFragmentedOperation : 0;
  this.state.masked = false;
  this.expect('Opcode', 2, this.processPacket);  
}

/**
 * Reset the parser state.
 *
 * @api private
 */

Parser.prototype.reset = function() {
  this.state = {
    activeFragmentedOperation: null,
    lastFragment: false,
    masked: false,
    opcode: 0
  };
  this.expectOffset = 0;
  this.expectBuffer = null;
  this.expectHandler = null;
  this.overflow = null;
  this.currentMessage = '';
}

/**
 * Unmask received data.
 *
 * @api private
 */

Parser.prototype.unmask = function (mask, buf) {
  if (mask != null) {
    for (var i = 0, ll = buf.length; i < ll; i++) {
      buf[i] ^= mask[i % 4];
    }    
  }
  return buf != null ? buf.toString('utf8') : '';
}

/**
 * Handles an error
 *
 * @api private
 */

Parser.prototype.error = function (reason) {
  this.reset();
  this.emit('error', reason);
  return this;
};
