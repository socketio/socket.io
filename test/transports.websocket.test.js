
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
    args[1] = parser.decodePacket(args[1].toString());
  }

  return WebSocket.prototype.emit.apply(this, arguments);
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
      , messages = 0
      , sid, sock, ws;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      setTimeout(function () {
        socket.send('buffered a');
        socket.send('buffered b');
      }, 10);

      setTimeout(function () {
        ws = websocket(cl, sid);
        ws.on('message', function (msg) {
          messages++;

          if (messages == 1) {
            msg.should.eql({ type: 'message', endpoint: '', data: 'buffered a' });
          } else if (messages === 2) {
            msg.should.eql({ type: 'message', endpoint: '', data: 'buffered b' });
            ws.close();
          }
        });
      }, 20);

      socket.on('disconnect', function () {
        messages.should.eql(2);

        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sessid) {
      sid = sessid;

      ws = websocket(cl, sid);
      ws.onopen = function () {
        ws.finishClose();
      };
    });
  },

  'test that not responding to a heartbeat drops client': function (done) {
    var cl = client(++ports)
      , io = create(cl);

    io.configure(function () {
      io.set('heartbeat interval', .05);
      io.set('heartbeat timeout', .05);
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function (reason) {
        beat.should.be.true;
        reason.should.eql('heartbeat timeout');

        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var ws = websocket(cl, sid);
      ws.on('message', function (packet) {
        packet.type.should.eql('heartbeat');
        beat = true;
      });
    });
  },

  'test that responding to a heartbeat maintains session': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , heartbeats = 0;

    io.configure(function () {
      io.set('heartbeat interval', .05);
      io.set('heartbeat timeout', .05);
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function (reason) {
        heartbeats.should.eql(2);
        reason.should.eql('heartbeat timeout');

        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var ws = websocket(cl, sid);
      ws.on('message', function (packet) {
        packet.type.should.eql('heartbeat');
        heartbeats++;

        if (heartbeats == 1) {
          ws.packet({ type: 'heartbeat' });
        }
      });
    });
  },

  'test sending undeliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , s;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        messaged.should.be.false;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var ws = websocket(cl, sid);
      ws.onopen = function () {
        ws.finishClose();

        setTimeout(function () {
          s.volatile.send('ah wha wha');

          ws = websocket(cl, sid);
          ws.on('message', function () {
            messaged = true;
          });

          setTimeout(function () {
            ws.finishClose();
          }, 10);
        }, 10);
      };

      ws.on('message', function () {
        messaged = true;
      });
    });
  },

  'test sending undeliverable volatile json': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , s;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        messaged.should.be.false;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var ws = websocket(cl, sid);
      ws.onopen = function () {
        ws.finishClose();

        setTimeout(function () {
          s.volatile.json.send({ a: 'b' });

          ws = websocket(cl, sid);
          ws.on('message', function () {
            messaged = true;
          });

          setTimeout(function () {
            ws.finishClose();
          }, 10);
        }, 10);
      };

      ws.on('message', function () {
        messaged = true;
      });
    });
  }

};
