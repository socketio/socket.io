/*global eio,eioc,listen,request,expect*/

var http = require('http');
var WebSocket = require('ws');

describe('JSONP', function () {
  before(function () {
    // we have to override the browser's functionality for JSONP
    document = {
      body: {
        appendChild: function () {}
        , removeChild: function () {}
      }
    }

    document.createElement = function (name) {
      var self = this;

      if('script' == name) {
        var script = {};

        script.__defineGetter__('parentNode', function () {
          return document.body;
        });

        script.__defineSetter__('src', function (uri) {
          request.get(uri).end(function(res) {
            eval(res.text);
          });
        });
        return script;
      } else if ('form' == name) {
        var form = {
          style: {}
            , action: ''
            , parentNode: { removeChild: function () {} }
            , removeChild: function () {}
            , setAttribute: function () {}
            , appendChild: function (elem) { area: elem; }
            , submit: function () {
              request.post(this.action).type('form').send({ d: self.areaValue }).end(function (res) {});
            }
        }
        return form;
      } else if ('textarea' == name) {
        var textarea = {};

        //a hack to be able to access the area data when form is sent
        textarea.__defineSetter__('value', function (data) {
          self.areaValue = data;
        });
        return textarea;
      } else {
        return {};
      }
    }

    document.getElementsByTagName = function (name) {
      return [{
        parentNode: {
          insertBefore: function () {}
        }
      }]
    }
  });

  after(function () {
    delete document.getElementsByTagName
      , document.createElement
      , document;
  });

  describe('handshake', function () {
    it('should open with polling JSONP when requested', function (done) {
      var engine = listen( { allowUpgrades: false, transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:' + port
          , { transports: ['polling'], forceJSONP: true, upgrade: false });
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('polling');
          expect(socket.transport.head).to.be('___eio[0](');
          done();
        });
      });
    });
  });

  describe('messages', function () {
    it('should arrive from client to server and back (pollingJSONP)', function (done) {
      var engine = listen( { allowUpgrades: false, transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:' + port
          , { transports: ['polling'], forceJSONP: true, upgrade: false });
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
    }); 
  });
  
  describe('close', function () {
    it('should trigger when server closes a client', function (done) {
      var engine = listen( { allowUpgrades: false, transports: ['polling'] }, function (port) {
          var socket = new eioc.Socket('ws://localhost:' + port
            , { transports: ['polling'], forceJSONP: true, upgrade: false })
            , total = 2;

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
      var engine = listen( { allowUpgrades: false, transports: ['polling'] }, function (port) {
          var socket = new eioc.Socket('ws://localhost:' + port
            , { transports: ['polling'], forceJSONP: true, upgrade: false })
            , total = 2;

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
