
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
      }, 30);

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
  },

  'test sending undeliverable volatile events': function (done) {
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
          s.volatile.emit({ a: 'b' });

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

  'test sending deliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.volatile.send('tobi');

      socket.on('disconnect', function () {
        messaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var ws = websocket(cl, sid);
      ws.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'tobi'
          , endpoint: ''
        });
        messaged = true;
        ws.finishClose();
      });
    });
  },

  'test sending deliverable volatile json': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.volatile.json.send([1, 2, 3]);

      socket.on('disconnect', function () {
        messaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var ws = websocket(cl, sid);
      ws.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: [1, 2, 3]
          , endpoint: ''
        });
        messaged = true;
        ws.finishClose();
      });
    });
  },

  'test sending deliverable volatile events': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.volatile.emit('tobi');

      socket.on('disconnect', function () {
        messaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var ws = websocket(cl, sid);
      ws.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'tobi'
          , endpoint: ''
          , args: []
        });
        messaged = true;
        ws.finishClose();
      });
    });
  },

  'test sending to all clients in a namespace': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , io = create(cl1)
      , messages = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections == 2) {
        io.sockets.send('yup');
      }

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 2) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'yup'
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'yup'
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });
  },

  'test sending json to all clients in a namespace': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , io = create(cl1)
      , messages = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections == 2) {
        console.log('sending json');
        io.sockets.json.send({ a: 'b' });
      }

      socket.on('disconnect', function () {
        disconnections++;
        console.log('disconnecitng');

        if (disconnections == 2) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: { a: 'b' }
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: { a: 'b' }
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });
  },

  'test emitting to all clients in a namespace': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , io = create(cl1)
      , messages = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections == 2) {
        io.sockets.emit('tobi', 'rapture');
      }

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 2) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'tobi'
          , args: ['rapture']
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'tobi'
          , args: ['rapture']
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });
  },

  'test sending to all clients in a room': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , joins = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections != 3) {
        socket.join('woot', function () {
          joins++;

          if (joins == 2) {
            io.sockets.in('woot').send('hahaha');
          }
        });
      }

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'hahaha'
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'hahaha'
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl2, sid);
      ws3.on('message', function (msg) {
        messages++;
      });

      setTimeout(function () {
        ws3.finishClose();
      }, 50);
    });
  },

  'test sending json to all clients in a room': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , joins = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections != 3) {
        socket.join('woot', function () {
          joins++;

          if (joins == 2) {
            io.sockets.in('woot').json.send(123);
          }
        });
      }

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: 123
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: 123
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl2, sid);
      ws3.on('message', function (msg) {
        messages++;
      });

      setTimeout(function () {
        ws3.finishClose();
      }, 50);
    });
  },

  'test emitting to all clients in a room': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , joins = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections != 3) {
        socket.join('woot', function () {
          joins++;

          if (joins == 2) {
            io.sockets.in('woot').emit('locki');
          }
        });
      }

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'locki'
          , args: []
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'locki'
          , args: []
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl2, sid);
      ws3.on('message', function (msg) {
        messages++;
      });

      setTimeout(function () {
        ws3.finishClose();
      }, 50);
    });
  },

  'test message with broadcast flag': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('trigger broadcast', function () {
        socket.broadcast.send('boom');
      });

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'boom'
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'boom'
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl2, sid);
      ws3.on('open', function () {
        ws3.packet({
            type: 'event'
          , name: 'trigger broadcast'
          , endpoint: ''
        });

        setTimeout(function () {
          ws3.finishClose();
        }, 50);
      });

      ws3.on('message', function (msg) {
        throw new Error('we shouldnt get a message here');
      });
    });
  },

  'test json with broadcast flag': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('trigger broadcast', function () {
        socket.broadcast.json.send([1, 2, 3]);
      });

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: [1, 2, 3]
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: [1, 2, 3]
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl2, sid);
      ws3.on('open', function () {
        ws3.packet({
            type: 'event'
          , name: 'trigger broadcast'
          , endpoint: ''
        });

        setTimeout(function () {
          ws3.finishClose();
        }, 50);
      });

      ws3.on('message', function (msg) {
        throw new Error('we shouldnt get a message here');
      });
    });
  },

  'test event with broadcast flag': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('trigger broadcast', function () {
        socket.broadcast.emit('hey', 'arnold');
      });

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(2);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'hey'
          , args: ['arnold']
          , endpoint: ''
        });

        messages++;
        ws1.finishClose();
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'hey'
          , args: ['arnold']
          , endpoint: ''
        });

        messages++;
        ws2.finishClose();
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl2, sid);
      ws3.on('open', function () {
        ws3.packet({
            type: 'event'
          , name: 'trigger broadcast'
          , endpoint: ''
        });

        setTimeout(function () {
          ws3.finishClose();
        }, 50);
      });

      ws3.on('message', function (msg) {
        throw new Error('we shouldnt get a message here');
      });
    });
  },

  'test message with broadcast flag and to()': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections == 1)
        socket.join('losers');

      socket.on('trigger broadcast', function () {
        socket.broadcast.to('losers').send('boom');
      });

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(1);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'message'
          , data: 'boom'
          , endpoint: ''
        });

        messages++;
      });

      ws1.on('open', function () {
        cl2.handshake(function (sid) {
          var ws2 = websocket(cl2, sid);
          ws2.on('message', function (msg) {
            throw new Error('This socket shouldnt get a message');
          });

          ws2.on('open', function () {
            cl3.handshake(function (sid) {
              var ws3 = websocket(cl2, sid);
              ws3.on('open', function () {
                ws3.packet({
                    type: 'event'
                  , name: 'trigger broadcast'
                  , endpoint: ''
                });

                setTimeout(function () {
                  ws1.finishClose();
                  ws2.finishClose();
                  ws3.finishClose();
                }, 50);
              });

              ws3.on('message', function (msg) {
                throw new Error('we shouldnt get a message here');
              });
            });
          });
        });
      });
    });
  },

  'test json with broadcast flag and to()': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections == 1)
        socket.join('losers');

      socket.on('trigger broadcast', function () {
        socket.broadcast.json.to('losers').send({ hello: 'world' });
      });

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(1);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'json'
          , data: { hello: 'world' }
          , endpoint: ''
        });

        messages++;
      });

      ws1.on('open', function () {
        cl2.handshake(function (sid) {
          var ws2 = websocket(cl2, sid);
          ws2.on('message', function (msg) {
            throw new Error('This socket shouldnt get a message');
          });

          ws2.on('open', function () {
            cl3.handshake(function (sid) {
              var ws3 = websocket(cl2, sid);
              ws3.on('open', function () {
                ws3.packet({
                    type: 'event'
                  , name: 'trigger broadcast'
                  , endpoint: ''
                });

                setTimeout(function () {
                  ws1.finishClose();
                  ws2.finishClose();
                  ws3.finishClose();
                }, 50);
              });

              ws3.on('message', function (msg) {
                throw new Error('we shouldnt get a message here');
              });
            });
          });
        });
      });
    });
  },

  'test event with broadcast flag and to()': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , cl3 = client(port)
      , io = create(cl1)
      , messages = 0
      , connections = 0
      , disconnections = 0;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      connections++;

      if (connections == 1)
        socket.join('losers');

      socket.on('trigger broadcast', function () {
        socket.broadcast.to('losers').emit('victory');
      });

      socket.on('disconnect', function () {
        disconnections++;

        if (disconnections == 3) {
          messages.should.eql(1);
          cl1.end();
          cl2.end();
          cl3.end();
          io.server.close();
          done();
        }
      });
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        msg.should.eql({
            type: 'event'
          , name: 'victory'
          , args: []
          , endpoint: ''
        });

        messages++;
      });

      ws1.on('open', function () {
        cl2.handshake(function (sid) {
          var ws2 = websocket(cl2, sid);
          ws2.on('message', function (msg) {
            throw new Error('This socket shouldnt get a message');
          });

          ws2.on('open', function () {
            cl3.handshake(function (sid) {
              var ws3 = websocket(cl2, sid);
              ws3.on('open', function () {
                ws3.packet({
                    type: 'event'
                  , name: 'trigger broadcast'
                  , endpoint: ''
                });

                setTimeout(function () {
                  ws1.finishClose();
                  ws2.finishClose();
                  ws3.finishClose();
                }, 50);
              });

              ws3.on('message', function (msg) {
                throw new Error('we shouldnt get a message here');
              });
            });
          });
        });
      });
    });
  },

};
