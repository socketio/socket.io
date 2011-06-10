
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
  , parser = sio.parser
  , ports = 15300;

/**
 * HTTPClient for htmlfile transport.
 */

function HTMLFile (port) {
  HTTPClient.call(this, port);
};

/**
 * Inhertis from HTTPClient.
 */

HTMLFile.prototype.__proto__ = HTTPClient.prototype;

/**
 * Override GET request with streaming parser.
 *
 * @api public
 */

var head = '<script>_('
  , foot = ');</script>'
  , initial = '<html><body>'
      + '<script>var _ = function (msg) { parent.s._(msg, document); };</script>'
      + new Array(174).join(' ')

HTMLFile.prototype.data = function (path, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts.buffer = false;

  return this.request(path, opts, function (res) {
    var buf = ''
      , messages = 0
      , state = 0;

    res.on('data', function (chunk) {
      buf += chunk;

      function parse () {
        switch (state) {
          case 0:
            if (buf.indexOf(initial) === 0) {
              buf = buf.substr(initial.length);
              state = 1;
            } else {
              break;
            }

          case 1:
            if (buf.indexOf(head) === 0) {
              buf = buf.substr(head.length);
              state = 2;
            } else {
              break;
            }

          case 2:
            if (buf.indexOf(foot) != -1) {
              var data = buf.slice(0, buf.indexOf(foot))
                , obj = JSON.parse(data);

              fn(obj === '' ? obj : parser.decodePayload(obj), ++messages);

              buf = buf.substr(data.length + foot.length);
              state = 1;

              parse();
            }
        };
      };

      parse();
    });
  });
};

/**
 * Create client for this transport.
 *
 * @api public
 */

function client (port) {
  return new HTMLFile(port);
};

/**
 * Tests.
 */

module.exports = {

  'test that not responding to a heartbeat drops client': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , beat = false;

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
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs, i) {
        switch (i) {
          case 1:
            msgs.should.have.length(1);
            msgs[0].type.should.eql('connect');
            msgs[0].endpoint.should.eql('');
            break;

          case 2:
            msgs.should.have.length(1);
            msgs[0].type.should.eql('heartbeat');
            beat = true;
        };
      });
    });
  },

  'test that responding to a heartbeat maintains session': function (done) {
    var port = ++ports
      , cl = client(port)
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
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs, i) {
        switch (i) {
          case 1:
            msgs.should.have.length(1);
            msgs[0].type.should.eql('connect');
            msgs[0].endpoint.should.eql('');
            break;

          default:
            msgs.should.have.length(1);
            msgs[0].type.should.eql('heartbeat');

            heartbeats++;

            if (heartbeats == 1) {
              cl.post('/socket.io/{protocol}/htmlfile/' + sid, parser.encodePacket({
                type: 'heartbeat'
              }));
            }
        }
      });
    });
  },

  'test sending undeliverable volatile messages': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , messaged = false
      , s;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        messaged.should.be.false;
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function () { });

      setTimeout(function () {
        cl.end();

        setTimeout(function () {
          s.volatile.send('wooooot');
          cl = client(port);
          cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs) {
            if (msgs && msgs.length)
              messaged = true;
          });

          setTimeout(function () {
            cl.end();
          }, 20);
        }, 20);
      }, 20);
    });
  },

  'test sending undeliverable volatile json': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , messaged = false
      , s;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        messaged.should.be.false;
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function () { });

      setTimeout(function () {
        cl.end();

        setTimeout(function () {
          s.volatile.json.send(123);

          cl = client(port);
          cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs) {
            if (msgs && msgs.length)
              messaged = true;
          });

          setTimeout(function () {
            cl.end();
          }, 20);
        }, 20);
      }, 20);
    });
  },

  'test sending undeliverable volatile events': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , messaged = false
      , s;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        messaged.should.be.false;
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function () { });

      setTimeout(function () {
        cl.end();

        setTimeout(function () {
          s.volatile.emit('tobi');

          cl = client(port);
          cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs) {
            if (msgs && msgs.length)
              messaged = true;
          });

          setTimeout(function () {
            cl.end();
          }, 20);
        }, 20);
      }, 20);
    });
  },

  'test sending deliverable volatile messages': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.volatile.send('woot');

      socket.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs, i) {
        switch (i) {
          case 1:
            msgs.should.have.length(1);
            msgs[0].type.should.eql('connect');
            msgs[0].endpoint.should.eql('');
            break;

          case 2:
            msgs.should.have.length(1);
            msgs[0].should.eql({
                type: 'message'
              , data: 'woot'
              , endpoint: ''
            });
            cl.end();
        }
      });
    });
  },

  'test sending deliverable volatile json': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.volatile.json.send(['woot']);

      socket.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs, i) {
        switch (i) {
          case 1:
            msgs.should.have.length(1);
            msgs[0].type.should.eql('connect');
            msgs[0].endpoint.should.eql('');
            break;

          case 2:
            msgs.should.have.length(1);
            msgs[0].should.eql({
                type: 'json'
              , data: ['woot']
              , endpoint: ''
            });
            cl.end();
        }
      });
    });
  },

  'test sending deliverable volatile events': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.volatile.emit('aaa');

      socket.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs, i) {
        switch (i) {
          case 1:
            msgs.should.have.length(1);
            msgs[0].type.should.eql('connect');
            msgs[0].endpoint.should.eql('');
            break;

          case 2:
            msgs.should.have.length(1);
            msgs[0].should.eql({
                type: 'event'
              , name: 'aaa'
              , endpoint: ''
              , args: []
            });
            cl.end();
        }
      });
    });
  }

};
