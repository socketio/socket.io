
/**
 * Tests dependencies.
 */

var parser = eio.parser
  , WebSocket = require('ws')

/**
 * Tests.
 */

describe('server', function () {

  describe('verification', function () {
    it('should disallow non-existent transports', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .send({ transport: 'tobi' }) // no tobi transport - outrageous
          .end(function (res) {
            expect(res.status).to.be(500);
            done();
          });
      });
    });

    it('should disallow `constructor` as transports', function (done) {
      // make sure we check for actual properties - not those present on every {}
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .send({ transport: 'constructor' })
          .end(function (res) {
            expect(res.status).to.be(500);
            done();
          });
      });
    });

    it('should disallow non-existent sids', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .send({ transport: 'polling', sid: 'test' })
          .end(function (res) {
            expect(res.status).to.be(500);
            done();
          });
      });
    });
  });

  describe('handshake', function () {
    it('should send the io cookie', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .send({ transport: 'polling' })
          .end(function (res) {
            // hack-obtain sid
            var sid = res.text.match(/"sid":"([0-9]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid);
            done();
          });
      });
    });

    it('should send the io cookie custom name', function (done) {
      var engine = listen({ cookie: 'woot' }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .send({ transport: 'polling' })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([0-9]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('woot=' + sid);
            done();
          });
      });
    });

    it('should not send the io cookie', function (done) {
      var engine = listen({ cookie: false }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .send({ transport: 'polling' })
          .end(function (res) {
            expect(res.headers['set-cookie']).to.be(undefined);
            done();
          });
      });
    });

    it('should register a new client', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        expect(Object.keys(engine.clients)).to.have.length(0);
        expect(engine.clientsCount).to.be(0);

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          expect(Object.keys(engine.clients)).to.have.length(1);
          expect(engine.clientsCount).to.be(1);
          done();
        });
      });
    });

    it('should exchange handshake data', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('handshake', function (obj) {
          expect(obj.sid).to.be.a('string');
          expect(obj.pingTimeout).to.be.a('number');
          expect(obj.upgrades).to.be.an('array');
          done();
        });
      });
    });

    it('should allow custom ping timeouts', function (done) {
      var engine = listen({ allowUpgrades: false, pingTimeout: 123 }, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.on('handshake', function (obj) {
          expect(obj.pingTimeout).to.be(123);
          done();
        });
      });
    });

    it('should trigger a connection event with a Socket', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (socket) {
          expect(socket).to.be.an(eio.Socket);
          done();
        });
      });
    });

    it('should open with polling by default', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('polling');
          done();
        });
      });
    });

    it('should be able to open with ws directly', function (done) {
      var engine = listen({ transports: ['websocket'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('websocket');
          done();
        });
      });
    });

    it('should not suggest any upgrades for websocket', function (done) {
      var engine = listen({ transports: ['websocket'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it('should not suggest upgrades when none are availble', function (done) {
      var engine = listen({ transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it('should only suggest available upgrades', function (done) {
      var engine = listen({ transports: ['polling', 'flashsocket'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(1);
          expect(obj.upgrades).to.have.contain('flashsocket');
          done();
        });
      });
    });

    it('should suggest all upgrades when no transports are disabled', function (done) {
      var engine = listen({}, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(2);
          expect(obj.upgrades).to.have.contain('flashsocket');
          expect(obj.upgrades).to.have.contain('websocket');
          done();
        });
      });
    });

    it('should allow arbitrary data through query string', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { query: { a: 'b' } });
        engine.on('connection', function (conn) {
          expect(conn.request.query).to.have.keys('transport', 'a');
          expect(conn.request.query.a).to.be('b');
          done();
        });
      });
    });
  });

  describe('close', function () {
    it('should trigger on server if the client does not pong', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 5, pingTimeout: 5 }
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.sendPacket = function (){};
        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('ping timeout');
            done();
          });
        });
      });
    });

    it('should trigger on client if server does not meet ping timeout', function (done) {
      var opts = { allowUpgrades: false, pingTimeout: 10 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          // override onPacket to simulate an inactive server after handshake
          socket.onPacket = function(){};
          socket.on('close', function (reason, err) {
            expect(reason).to.be('ping timeout');
            done();
          });
        });
      });
    });

    it('should trigger on both ends upon ping timeout', function (done) {
      var opts = { allowUpgrades: false, pingTimeout: 10, pingInterval: 10 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , total = 2

        function onClose (reason, err) {
          expect(reason).to.be('ping timeout');
          --total || done();
        }

        engine.on('connection', function (conn) {
          conn.on('close', onClose);
        });

        socket.on('open', function () {
          // override onPacket to simulate an inactive server after handshake
          socket.onPacket = socket.sendPacket = function(){};
          socket.on('close', onClose);
        });
      });
    });

    it('should trigger when server closes a client', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });
          setTimeout(function () {
            conn.close();
          }, 10);
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });
      });
    });

    it('should trigger when server closes a client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] })
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });
          setTimeout(function () {
            conn.close();
          }, 10);
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });
      });
    });

    it('should trigger when client closes', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });

          setTimeout(function () {
            socket.close();
          }, 10);
        });
      });
    });

    it('should trigger when client closes (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] })
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });

          setTimeout(function () {
            socket.close();
          }, 10);
        });
      });
    });

    it('should abort upgrade if socket is closed (GH-35)', function (done) {
      var engine = listen({ allowUpgrades: true }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          socket.close();
          // we wait until complete to see if we get an uncaught EPIPE
          setTimeout(function(){
            done();
          }, 100);
        });
      });
    });
  });

  describe('messages', function () {
    it('should arrive from server to client', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.send('a');
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be('a');
            done();
          });
        });
      });
    });

    

    it('should arrive from server to client (multiple)', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , expected = ['a', 'b', 'c']
          , i = 0

        engine.on('connection', function (conn) {
          conn.send('a');
          // we use set timeouts to ensure the messages are delivered as part
          // of different.
          setTimeout(function () {
            conn.send('b');

            setTimeout(function () {
              // here we make sure we buffer both the close packet and
              // a regular packet
              conn.send('c');
              conn.close();
            }, 50);
          }, 50);

          conn.on('close', function () {
            // since close fires right after the buffer is drained
            setTimeout(function () {
              expect(i).to.be(3);
              done();
            }, 50);
          });
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });

    it('should arrive from server to client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        engine.on('connection', function (conn) {
          conn.send('a');
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be('a');
            done();
          });
        });
      });
    });

    it('should arrive from server to client with ws api', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        engine.on('connection', function (conn) {
          conn.send('a');
          conn.close();
        });
        socket.onopen = function () {
          socket.onmessage = function (msg) {
            expect(msg.data).to.be('a');
            expect('' + msg == 'a').to.be(true);
          };
          socket.onclose = function () {
            done();
          };
        };
      });
    });

    it('should arrive from server to client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] })
          , expected = ['a', 'b', 'c']
          , i = 0
        engine.on('connection', function (conn) {
          conn.send('a');
          setTimeout(function () {
            conn.send('b');
            setTimeout(function () {
              conn.send('c');
              conn.close();
            }, 50);
          }, 50);
          conn.on('close', function () {
            setTimeout(function () {
              expect(i).to.be(3);
              done();
            }, 50);
          });
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });
  });

  describe('send', function(){
    describe('callback', function(){
         it('should execute when message sent (polling)', function (done) {
          var engine = listen({ allowUpgrades: false }, function (port) {
            var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] }),
                i = 0;
            engine.on('connection', function (conn) {
              conn.send('a', function(transport) {
                i++;
              });
            });
            socket.on('open', function () {
              socket.on('message', function (msg) {
                i++;
              });
            });

            setTimeout(function(){
                expect(i).to.be(2);
                done();
            },10);
          });
        });

        it('should execute when message sent (websocket)', function (done) {
          var engine = listen({ allowUpgrades: false }, function (port) {
            var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] }),
                i = 0;
            engine.on('connection', function (conn) {
              conn.send('a', function(transport) {
                i++;
              });
            });
            socket.on('open', function () {
              socket.on('message', function (msg) {
                i++;
              });
            });

            setTimeout(function(){
                expect(i).to.be(2);
                done();
            },10);
          });
        });

        it('should execute once for each send', function (done) {
          var engine = listen(function (port) {
            var socket = new eioc.Socket('ws://localhost:%d'.s(port)),
                i = 0,
                j = 0;
            engine.on('connection', function (conn) {
              conn.send('b', function (transport) {
                j++;
              }); 
                
              conn.send('a', function (transport) {
                i++;
              });
              
            });
            socket.on('open', function () {
              socket.on('message', function (msg) {
                if (msg == "a") {
                    i++;
                } else if (msg == "b") {
                    j++;
                }
              });
            });

            setTimeout(function () {
                expect(i).to.be(2);
                expect(j).to.be(2);
                done();
            }, 50);
          });
        });

        it('should execute in mutlipart packet', function (done) {
          var engine = listen(function (port) {
            var socket = new eioc.Socket('ws://localhost:%d'.s(port)),
                i = 0;
            engine.on('connection', function (conn) {
              conn.send('b', function (transport) {
                i++;
              }); 
                
              conn.send('a', function(transport) {
                i++;
              });
              
            });
            socket.on('open', function () {
              socket.on('message', function (msg) {
                i++;
              });
            });

            setTimeout(function () {
                expect(i).to.be(4);
                done();
            }, 50);
          });
        });
        
        it('should execute in separate message', function (done) {
          var engine = listen(function (port) {
            var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] }),
                i = 0;
            engine.on('connection', function (conn) {
                
              conn.send('a', function(transport) {
                i++;
                
                conn.send('b', function (transport) {
                    i++;
                }); 
              });
            });
            
            socket.on('open', function () {
              socket.on('message', function (msg) {
                i++;
              });
            });

            setTimeout(function () {
                expect(i).to.be(4);
                done();
            }, 10);
          });
        });

    });
  });

  describe('upgrade', function () {
    it('should upgrade', function (done) {
      var engine = listen(function (port) {
        // it takes both to send 50 to verify
        var ready = 2, closed = 2;
        function finish () {
          setTimeout(function () {
            socket.close();
          }, 10);
        }

        // server
        engine.on('connection', function (conn) {
          var lastSent = 0, lastReceived = 0, upgraded = false;
          var interval = setInterval(function () {
            lastSent++;
            conn.send(lastSent);
            if (50 == lastSent) {
              clearInterval(interval);
              --ready || finish();
            }
          }, 2);

          conn.on('message', function (msg) {
            lastReceived++;
            expect(msg).to.eql(lastReceived);
          });

          conn.on('upgrade', function (to) {
            upgraded = true;
            expect(to.name).to.be('websocket');
          });

          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            expect(lastSent).to.be(50);
            expect(lastReceived).to.be(50);
            expect(upgraded).to.be(true);
            --closed || done();
          });
        });

        // client
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          var lastSent = 0, lastReceived = 0, upgrades = 0;
          var interval = setInterval(function () {
            lastSent++;
            socket.send(lastSent);
            if (50 == lastSent) {
              clearInterval(interval);
              --ready || finish();
            }
          }, 2);
          socket.on('upgrading', function (to) {
            // we want to make sure for the sake of this test that we have a buffer
            expect(to.name).to.equal('websocket');
            upgrades++;

            // force send a few packets to ensure we test buffer transfer
            lastSent++;
            socket.send(lastSent);
            lastSent++;
            socket.send(lastSent);

            expect(socket.writeBuffer).to.not.be.empty();
          });
          socket.on('upgrade', function (to) {
            expect(to.name).to.equal('websocket');
            upgrades++;
          });
          socket.on('message', function (msg) {
            lastReceived++;
            expect(lastReceived).to.eql(msg);
          });
          socket.on('close', function (reason) {
            expect(reason).to.be('forced close');
            expect(lastSent).to.be(50);
            expect(lastReceived).to.be(50);
            expect(upgrades).to.be(2);
            --closed || done();
          });
        });
      });
    });
  });

});
