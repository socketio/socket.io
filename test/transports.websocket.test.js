
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
  , parser = sio.parser
  , ports = 15800;

/**
 * Tests.
 */

module.exports = {

  'test that not responding to a heartbeat drops client': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messages = 0
      , ws;

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
        ws.finishClose();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('message', function (packet) {
        if (++messages == 1) {
          packet.type.should.eql('connect');
        } else {
          packet.type.should.eql('heartbeat');
          beat = true;
        }
      });
    });
  },

  'test that responding to a heartbeat maintains session': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messages = 0
      , heartbeats = 0
      , ws;

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
        ws.finishClose();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('message', function (packet) {
        if (++messages == 1) {
          packet.type.should.eql('connect');
        } else {
          packet.type.should.eql('heartbeat');
          heartbeats++;

          if (heartbeats == 1) {
            ws.packet({ type: 'heartbeat' });
          }
        }
      });
    });
  },

  'test sending undeliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messages = 0
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
      ws.on('message', function (msg) {
        msg.type.should.eql('connect');
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
      ws.on('message', function () {
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
      ws.on('message', function () {
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
      });
    });
  },

  'test sending deliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messages = 0
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
        if (++messages == 1) {
          msg.type.should.eql('connect');
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'tobi'
            , endpoint: ''
          });
          messaged = true;
          ws.finishClose();
        }
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
        if (!ws.connected) {
          msg.type.should.eql('connect');
          ws.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: [1, 2, 3]
            , endpoint: ''
          });
          messaged = true;
          ws.finishClose();
        }
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
        if (!ws.connected) {
          msg.type.should.eql('connect');
          ws.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'tobi'
            , endpoint: ''
            , args: []
          });
          messaged = true;
          ws.finishClose();
        }
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'yup'
            , endpoint: ''
          });

          messages++;
          ws1.finishClose();
        }
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'yup'
            , endpoint: ''
          });

          messages++;
          ws2.finishClose();
        }
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
        io.sockets.json.send({ a: 'b' });
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: { a: 'b' }
            , endpoint: ''
          });

          messages++;
          ws1.finishClose();
        }
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: { a: 'b' }
            , endpoint: ''
          });

          messages++;
          ws2.finishClose();
        }
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'tobi'
            , args: ['rapture']
            , endpoint: ''
          });

          messages++;
          ws1.finishClose();
        }
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'tobi'
            , args: ['rapture']
            , endpoint: ''
          });

          messages++;
          ws2.finishClose();
        }
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
        socket.join('woot');
        joins++;

        if (joins == 2) {
          setTimeout(function () {
            connections.should.eql(3);
            io.sockets.in('woot').send('hahaha');
          }, 20);
        }
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'hahaha'
            , endpoint: ''
          });

          messages++;
        }
      });

      setTimeout(function () {
        ws1.finishClose();
      }, 50);
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'hahaha'
            , endpoint: ''
          });

          messages++;
        }
      });

      setTimeout(function () {
        ws2.finishClose();
      }, 50);
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl3, sid);
      ws3.on('message', function (msg) {
        if (!ws3.connected) {
          msg.type.should.eql('connect');
          ws3.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'hahaha'
            , endpoint: ''
          });

          messages++;
        }
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
        socket.join('woot');
        joins++;

        if (joins == 2) {
          setTimeout(function () {
            connections.should.eql(3);
            io.sockets.in('woot').json.send(123);
          }, 20);
        }
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: 123
            , endpoint: ''
          });

          messages++;
        }
      });

      setTimeout(function () {
        ws1.finishClose();
      }, 50);
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: 123
            , endpoint: ''
          });

          messages++;
        }
      });

      setTimeout(function () {
        ws2.finishClose();
      }, 50);
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl3, sid);
      ws3.on('message', function (msg) {
        if (!ws3.connected) {
          msg.type.should.eql('connect');
          ws3.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: 123
            , endpoint: ''
          });

          messages++;
        }
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
        socket.join('woot');
        joins++;

        if (joins == 2) {
          setTimeout(function () {
            connections.should.eql(3);
            io.sockets.in('woot').emit('locki');
          }, 20);
        }
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'locki'
            , args: []
            , endpoint: ''
          });

          messages++;
        }
      });

      setTimeout(function () {
        ws1.finishClose();
      }, 50);
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'locki'
            , args: []
            , endpoint: ''
          });

          messages++;
        }
      });

      setTimeout(function () {
        ws2.finishClose();
      }, 50);
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl3, sid);
      ws3.on('message', function (msg) {
        if (!ws3.connected) {
          msg.type.should.eql('connect');
          ws3.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'locki'
            , args: []
            , endpoint: ''
          });

          messages++;
        }
      });

      setTimeout(function () {
        ws3.finishClose();
      }, 50);
    });
  },

  'test leaving a room': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , io = create(cl1)
      , joins = 0
      , disconnects = 0;

    io.set('close timeout', 0);

    io.sockets.on('connection', function (socket) {
      socket.join('foo');
      io.sockets.clients('foo').should.have.length(++joins);

      socket.on('disconnect', function () {
        socket.leave('foo');
        socket.leave('foo');
        socket.leave('foo');

        io.sockets.clients('foo').should.have.length(--joins);

        if (++disconnects == 2) {
          io.server.close();
          cl1.end();
          cl2.end();
          done();
        }
      })
    });

    cl1.handshake(function (sid) {
      var ws1 = websocket(cl1, sid);
      ws1.on('message', function (msg) {
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
           ws1.finishClose();
        }
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
          ws2.finishClose();
        }
      });
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'boom'
            , endpoint: ''
          });

          messages++;
          ws1.finishClose();
        }
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'boom'
            , endpoint: ''
          });

          messages++;
          ws2.finishClose();
        }
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl3, sid);
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
        if (!ws3.connected) {
          msg.type.should.eql('connect');
          ws3.connected = true;
        } else {
          throw new Error('we shouldnt get a message here');
        }
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: [1, 2, 3]
            , endpoint: ''
          });

          messages++;
          ws1.finishClose();
        }
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: [1, 2, 3]
            , endpoint: ''
          });

          messages++;
          ws2.finishClose();
        }
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl3, sid);
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
        if (!ws3.connected) {
          msg.type.should.eql('connect');
          ws3.connected = true;
        } else {
          throw new Error('we shouldnt get a message here');
        }
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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'hey'
            , args: ['arnold']
            , endpoint: ''
          });

          messages++;
          ws1.finishClose();
        }
      });
    });

    cl2.handshake(function (sid) {
      var ws2 = websocket(cl2, sid);
      ws2.on('message', function (msg) {
        if (!ws2.connected) {
          msg.type.should.eql('connect');
          ws2.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'hey'
            , args: ['arnold']
            , endpoint: ''
          });

          messages++;
          ws2.finishClose();
        }
      });
    });

    cl3.handshake(function (sid) {
      var ws3 = websocket(cl3, sid);
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
        if (!ws3.connected) {
          msg.type.should.eql('connect');
          ws3.connected = true;
        } else {
          throw new Error('we shouldnt get a message here');
        }
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

      if (connections == 1) {
        socket.join('losers');
      }

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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'message'
            , data: 'boom'
            , endpoint: ''
          });

          messages++;
        }
      });

      ws1.on('open', function () {
        cl2.handshake(function (sid) {
          var ws2 = websocket(cl2, sid);
          ws2.on('message', function (msg) {
            if (!ws2.connected) {
              msg.type.should.eql('connect');
              ws2.connected = true;
            } else {
              throw new Error('This socket shouldnt get a message');
            }
          });

          ws2.on('open', function () {
            cl3.handshake(function (sid) {
              var ws3 = websocket(cl3, sid);
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
                if (!ws3.connected) {
                  msg.type.should.eql('connect');
                  ws3.connected = true;
                } else {
                  throw new Error('we shouldnt get a message here');
                }
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

      if (connections == 1) {
        socket.join('losers');
      }

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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'json'
            , data: { hello: 'world' }
            , endpoint: ''
          });

          messages++;
        }
      });

      ws1.on('open', function () {
        cl2.handshake(function (sid) {
          var ws2 = websocket(cl2, sid);
          ws2.on('message', function (msg) {
            if (!ws2.connected) {
              msg.type.should.eql('connect');
              ws2.connected = true;
            } else {
              throw new Error('This socket shouldnt get a message');
            }
          });

          ws2.on('open', function () {
            cl3.handshake(function (sid) {
              var ws3 = websocket(cl3, sid);
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
                if (!ws3.connected) {
                  msg.type.should.eql('connect');
                  ws3.connected = true;
                } else {
                  throw new Error('we shouldnt get a message here');
                }
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

      if (connections == 1) {
        socket.join('losers');
      }

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
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
        } else {
          msg.should.eql({
              type: 'event'
            , name: 'victory'
            , args: []
            , endpoint: ''
          });

          messages++;
        }
      });

      ws1.on('open', function () {
        cl2.handshake(function (sid) {
          var ws2 = websocket(cl2, sid);
          ws2.on('message', function (msg) {
            if (!ws2.connected) {
              msg.type.should.eql('connect');
              ws2.connected = true;
            } else {
              throw new Error('This socket shouldnt get a message');
            };
          });

          ws2.on('open', function () {
            cl3.handshake(function (sid) {
              var ws3 = websocket(cl3, sid);
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
                if (!ws3.connected) {
                  msg.type.should.eql('connect');
                  ws3.connected = true;
                } else {
                  throw new Error('we shouldnt get a message here');
                }
              });
            });
          });
        });
      });
    });
  },

  'test accessing handshake data from sockets': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , ws;

    io.sockets.on('connection', function (socket) {
      (!!socket.handshake.address.address).should.be.true;
      (!!socket.handshake.address.port).should.be.true;
      socket.handshake.headers.host.should.equal('localhost');
      socket.handshake.headers.connection.should.equal('keep-alive');
      socket.handshake.time.should.match(/GMT/);

      socket.on('disconnect', function () {
        setTimeout(function () {
          ws.finishClose();
          cl.end();
          io.server.close();
          done();
        }, 10);
      });

      socket.disconnect();
    });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('message', function (msg) {
        if (!ws.connected) {
          msg.type.should.eql('connect');
          ws.connected = true;
        }
      });
    });
  },

  'test accessing the array of clients': function (done) {
    var port = ++ports
      , cl1 = client(port)
      , cl2 = client(port)
      , io = create(cl1)
      , total = 2
      , ws1, ws2;

    io.sockets.on('connection', function (socket) {
      socket.on('join ferrets', function () {
        socket.join('ferrets');
        socket.send('done');
      });
    });

    function check() {
      io.sockets.clients('ferrets').should.have.length(1);
      io.sockets.clients('ferrets')[0].should.be.an.instanceof(sio.Socket);
      io.sockets.clients('ferrets')[0].id.should.equal(ws1.sid);
      io.sockets.clients().should.have.length(2);
      io.sockets.clients()[0].should.be.an.instanceof(sio.Socket);
      io.sockets.clients()[0].id.should.equal(ws1.sid);
      io.sockets.clients()[1].should.be.an.instanceof(sio.Socket);
      io.sockets.clients()[1].id.should.equal(ws2.sid);

      ws1.finishClose();
      ws2.finishClose();
      cl1.end();
      cl2.end();
      io.server.close();
      done();
    };

    cl1.handshake(function (sid) {
      ws1 = websocket(cl1, sid);
      ws1.sid = sid;
      ws1.on('message', function (msg) {
        if (!ws1.connected) {
          msg.type.should.eql('connect');
          ws1.connected = true;
          ws1.packet({
              type: 'event'
            , name: 'join ferrets'
            , endpoint: ''
          });
        } else {
          cl2.handshake(function (sid) {
            ws2 = websocket(cl2, sid);
            ws2.sid = sid;
            ws2.on('message', function (msg) {
              if (!ws2.connected) {
                msg.type.should.eql('connect');
                ws2.connected = true;
                check();
              }
            });
          });
        }
      });
    });
  },

  'test accessing handshake data from sockets on disconnect': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , ws;

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {

      (!!socket.handshake.address.address).should.be.true;
      (!!socket.handshake.address.port).should.be.true;
      socket.handshake.headers.host.should.equal('localhost');
      socket.handshake.headers.connection.should.equal('keep-alive');
      socket.handshake.time.should.match(/GMT/);

        setTimeout(function () {
          ws.finishClose();
          cl.end();
          io.server.close();
          done();
        }, 10);
      });

      socket.disconnect();
    });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('message', function (msg) {
        if (!ws.connected) {
          msg.type.should.eql('connect');
          ws.connected = true;
        }
      });
    });
  },

  'test for intentional and unintentional disconnects': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , calls = 0
      , ws;

    function close () {
      cl.end();
      io.server.close();
      ws.finishClose();
      done();
    }

    io.configure(function () {
      io.set('heartbeat interval', .05);
      io.set('heartbeat timeout', .05);
      io.set('close timeout', 0);
    });

    io.of('/foo').on('connection', function (socket) {
      socket.on('disconnect', function (reason) {
       reason.should.equal('packet');

       if (++calls == 2) close();
      });
    });

    io.of('/bar').on('connection', function (socket) {
      socket.on('disconnect', function (reason) {
        reason.should.equal('socket end');

        if (++calls == 2) close();
      });
    });

    cl.handshake(function (sid) {
      var messages = 0;
      ws = websocket(cl, sid);
      ws.on('open', function () {
        ws.packet({
            type: 'connect'
          , endpoint: '/foo'
        });
        ws.packet({
            type: 'connect'
          , endpoint: '/bar'
        });
      });

      ws.on('message', function (packet) {
        if (packet.type == 'connect') {
          if (++messages === 3) {
            ws.packet({ type: 'disconnect', endpoint:'/foo' });
            ws.finishClose();
          }
        }
      });
    });
  },

  'test socket clean up': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , ws;

    io.sockets.on('connection', function (socket) {
      var self = this
        , id = socket.id;

      socket.on('disconnect', function () {
        setTimeout(function () {
          var available = !!self.sockets[id];

          available.should.be.false;
          ws.finishClose();
          cl.end();
          io.server.close();
          done();
        }, 10);
      });

      socket.disconnect();
    });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('message', function (msg) {
        if (!ws.connected) {
          msg.type.should.eql('connect');
          ws.connected = true;
        }
      });
    });
  },

};
