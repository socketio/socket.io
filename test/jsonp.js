
/**
 * Module dependencies.
 */

var eioc = require('engine.io-client');
var listen = require('./common').listen;
var expect = require('expect.js');
var request = require('superagent');

describe('JSONP', function () {
  before(function () {
    // we have to override the browser's functionality for JSONP
    document = { // eslint-disable-line no-native-reassign, no-undef
      body: {
        appendChild: function () {},
        removeChild: function () {}
      }
    };

    document.createElement = function (name) {
      var self = this;

      if ('script' === name) {
        var script = {};

        script.__defineGetter__('parentNode', function () {
          return document.body;
        });

        script.__defineSetter__('src', function (uri) {
          request.get(uri).end(function (res) {
            eval(res.text); // eslint-disable-line no-eval
          });
        });
        return script;
      } else if ('form' === name) {
        var form = {
          style: {},
          action: '',
          parentNode: { removeChild: function () {} },
          removeChild: function () {},
          setAttribute: function () {},
          appendChild: function () {},
          submit: function () {
            request
            .post(this.action)
            .type('form')
            .send({ d: self.areaValue })
            .end(function () {});
          }
        };
        return form;
      } else if ('textarea' === name) {
        var textarea = {};

        // a hack to be able to access the area data when form is sent
        textarea.__defineSetter__('value', function (data) {
          self.areaValue = data;
        });
        return textarea;
      } else if (~name.indexOf('iframe')) {
        var iframe = {};
        setTimeout(function () {
          if (iframe.onload) iframe.onload();
        }, 0);

        return iframe;
      } else {
        return {};
      }
    };

    document.getElementsByTagName = function (name) {
      return [{
        parentNode: {
          insertBefore: function () {}
        }
      }];
    };
  });

  after(function () {
    delete document.getElementsByTagName;
    delete document.createElement;
    delete global.document;
  });

  describe('handshake', function () {
    it('should open with polling JSONP when requested', function (done) {
      var engine = listen({ allowUpgrades: false, transports: ['polling'] }, function (port) {
        eioc('ws://localhost:' + port,
          { transports: ['polling'], forceJSONP: true, upgrade: false });
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('polling');
          expect(socket.transport.head).to.be('___eio[0](');
          done();
        });
      });
    });
  });

  describe('messages', function () {
    var engine, port, socket;

    beforeEach(function (done) {
      engine = listen({ allowUpgrades: false, transports: ['polling'] }, function (p) {
        port = p;

        socket = new eioc.Socket('ws://localhost:' + port
          , { transports: ['polling'], forceJSONP: true, upgrade: false });

        done();
      });
    });

    it('should arrive from client to server and back (pollingJSONP)', function (done) {
      engine.on('connection', function (conn) {
        conn.on('message', function (msg) {
          conn.send('a');
        });
      });

      socket.on('open', function () {
        socket.send('a');
        socket.on('message', function (msg) {
          expect(socket.transport.query.j).to.not.be(undefined);
          expect(msg).to.be('a');
          done();
        });
      });
    });

    it('should not fail JSON.parse for stringified messages', function (done) {
      engine.on('connection', function (conn) {
        conn.on('message', function (message) {
          expect(JSON.parse(message)).to.be.eql({test: 'a\r\nb\n\n\n\nc'});
          done();
        });
      });
      socket.on('open', function () {
        socket.send(JSON.stringify({test: 'a\r\nb\n\n\n\nc'}));
      });
    });

    it('should parse newlines in message correctly', function (done) {
      engine.on('connection', function (conn) {
        conn.on('message', function (message) {
          expect(message).to.be.equal('a\r\nb\n\n\n\nc');
          done();
        });
      });
      socket.on('open', function () {
        socket.send('a\r\nb\n\n\n\nc');
      });
    });

    it('should arrive from server to client and back with binary data (pollingJSONP)', function (done) {
      var binaryData = new Buffer(5);
      for (var i = 0; i < 5; i++) binaryData[i] = i;
      engine.on('connection', function (conn) {
        conn.on('message', function (msg) {
          conn.send(msg);
        });
      });

      socket.on('open', function () {
        socket.send(binaryData);
        socket.on('message', function (msg) {
          for (var i = 0; i < msg.length; i++) expect(msg[i]).to.be(i);
          done();
        });
      });
    });
  });

  describe('close', function () {
    it('should trigger when server closes a client', function (done) {
      var engine = listen({ allowUpgrades: false, transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:' + port,
            { transports: ['polling'], forceJSONP: true, upgrade: false });
        var total = 2;

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
      var engine = listen({ allowUpgrades: false, transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:' + port
          , { transports: ['polling'], forceJSONP: true, upgrade: false });
        var total = 2;

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });

        socket.on('open', function () {
          socket.send('a');
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
  });
});
