
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var sio = require('socket.io')
  , should = require('./common')
  , HTTPClient = should.HTTPClient
  , WebSocket = require('../support/node-websocket-client/lib/websocket').WebSocket
  , parser = sio.parser
  , ports = 15400;

/**
 * WebSocket socket.io client.
 *
 * @api private
 */

function WSClient (port, sid) {
  this.sid = sid;
  this.port = port;

  WebSocket.call(
      this
    , 'ws://localhost:' + port + '/socket.io/' 
      + sio.protocol + '/websocket/' + sid
  );
};

/**
 * Inherits from WebSocket.
 */

WSClient.prototype.__proto__ = WebSocket.prototype;

/**
 * Overrides message event emission.
 *
 * @api private
 */

WSClient.prototype.emit = function (name) {
  var args = arguments;

  if (name == 'message' || name == 'data') {
    args[1] = parse.decodePacket(args[1]);
  }

  return WebSocket.prototype.emit.apply(this, args);
};

/**
 * Writes a packet
 */

WSClient.prototype.packet = function (pack) {
  this.write(parser.encodePacket(pack));
  return this;
};

/**
 * Creates a websocket client.
 *
 * @api public
 */

function websocket (cl, sid) {
  return new WSClient(cl.port, sid);
};

/**
 * Tests.
 */

module.exports = {

  'test message buffering and websocket payload': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , sid, ws;

    io.sockets.on('connection', function (socket) {
      var messages = 0;

      ws.close();

      socket.send('buffered a');
      socket.send('buffered b');

      socket.on('disconnect', function () {
        messages.should.eql(2);

        ws.close();
        cl.end();
        io.server.close();
        done();
      });

      ws = websocket(cl, sid);
      ws.on('message', function (msg) {
        messages++;

        if (messages == 1) {
          msg.should.eql({ type: 'message', endpoint: '', data: 'buffered a' });
        } else if (messages === 2) {
          msg.should.eql({ type: 'message', endpoint: '', data: 'buffered b' });
        }
      });
    });

    cl.handshake(function (sessid) {
      sid = sessid;
      ws = websocket(cl, sid);
    });
  }

};
