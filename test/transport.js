
var expect = require('expect.js');
var eio = require('../');
var env = require('./support/env');

describe('Transport', function () {

  describe('rememberUpgrade', function () {
    it('should remember websocket connection', function (done) {
      var socket = new eio.Socket();
      expect(socket.transport.name).to.be('polling');

      var timedout = false;
      var timeout = setTimeout(function(){
        timedout = true;
        socket.close();
        done();
      }, 300);

      socket.on('upgrade', function (transport) {
        if (timedout) return;
        clearTimeout(timeout);
        socket.close();
        if(transport.name == 'websocket') {
          var socket2 = new eio.Socket({ 'rememberUpgrade': true });
          expect(socket2.transport.name).to.be('websocket');
        }
        done();
      });
    });

    it('should not remember websocket connection', function (done) {
      var socket = new eio.Socket();
      expect(socket.transport.name).to.be('polling');

      var timedout = false;
      var timeout = setTimeout(function(){
        timedout = true;
        socket.close();
        done();
      }, 300);

      socket.on('upgrade', function (transport) {
        if (timedout) return;
        clearTimeout(timeout);
        socket.close();
        if(transport.name == 'websocket') {
          var socket2 = new eio.Socket({ 'rememberUpgrade': false });
          expect(socket2.transport.name).to.not.be('websocket');
        }
        done();
      });
    });
  });

  describe('public constructors', function () {
    it('should include Transport', function () {
      expect(eio.Transport).to.be.a('function');
    });

    it('should include Polling and WebSocket', function () {
      expect(eio.transports).to.be.an('object');
      expect(eio.transports.polling).to.be.a('function');
      expect(eio.transports.websocket).to.be.a('function');
    });
  });

  describe('transport uris', function () {
    it('should generate an http uri', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: false
        , query: { sid: 'test' }
        , timestampRequests: false
      });
      expect(polling.uri()).to.contain('http://localhost/engine.io?sid=test');
    });

    it('should generate an http uri w/o a port', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: false
        , query: { sid: 'test' }
        , port: 80
        , timestampRequests: false
      });
      expect(polling.uri()).to.contain('http://localhost/engine.io?sid=test');
    });

    it('should generate an http uri with a port', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: false
        , query: { sid: 'test' }
        , port: 3000
        , timestampRequests: false
      });
      expect(polling.uri()).to.contain('http://localhost:3000/engine.io?sid=test');
    });

    it('should generate an https uri w/o a port', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: true
        , query: { sid: 'test' }
        , port: 443
        , timestampRequests: false
      });
      expect(polling.uri()).to.contain('https://localhost/engine.io?sid=test');
    });

    it('should generate a timestamped uri', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , timestampParam: 't'
        , timestampRequests: true
      });
      expect(polling.uri()).to.match(/http:\/\/localhost\/engine\.io\?(j=[0-9]+&)?(t=[0-9A-Za-z-_]+)/);
    });

    it('should generate an ipv6 uri', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: '::1'
        , secure: false
        , port: 80
        , timestampRequests: false
      });
      expect(polling.uri()).to.contain('http://[::1]/engine.io');
    });

    it('should generate an ipv6 uri with port', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: '::1'
        , secure: false
        , port: 8080
        , timestampRequests: false
      });
      expect(polling.uri()).to.contain('http://[::1]:8080/engine.io');
    });

    it('should generate a ws uri', function () {
      var ws = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: 'test'
        , secure: false
        , query: { transport: 'websocket' }
        , timestampRequests: false
      });
      expect(ws.uri()).to.be('ws://test/engine.io?transport=websocket');
    });

    it('should generate a wss uri', function () {
      var ws = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: 'test'
        , secure: true
        , query: {}
        , timestampRequests: false
      });
      expect(ws.uri()).to.be('wss://test/engine.io');
    });

    it('should timestamp ws uris', function () {
      var ws = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: 'localhost'
        , timestampParam: 'woot'
        , timestampRequests: true
      });
      expect(ws.uri()).to.match(/ws:\/\/localhost\/engine\.io\?woot=[0-9A-Za-z-_]+/);
    });

    it('should generate a ws ipv6 uri', function () {
      var ws = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: '::1'
        , secure: false
        , port: 80
        , timestampRequests: false
      });
      expect(ws.uri()).to.be('ws://[::1]/engine.io');
    });

    it('should generate a ws ipv6 uri with port', function () {
      var ws = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: '::1'
        , secure: false
        , port: 8080
        , timestampRequests: false
      });
      expect(ws.uri()).to.be('ws://[::1]:8080/engine.io');
    });
  });

// these are server only
if (!env.browser) {
  describe('options', function () {
    it('should accept an `agent` option for WebSockets', function (done) {
      var polling = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: 'localhost'
        , agent: {
            addRequest: function () {
              done();
            }
          }
      });
      polling.doOpen();
    });
    it('should accept an `agent` option for XMLHttpRequest', function (done) {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , agent: {
            addRequest: function () {
              done();
            }
          }
      });
      polling.doOpen();
    });

    describe('for extraHeaders', function () {
      it('should correctly set them for WebSockets', function () {
        var headers = {
          'X-Custom-Header-For-My-Project': 'my-secret-access-token',
          'Cookie': 'user_session=NI2JlCKF90aE0sJZD9ZzujtdsUqNYSBYxzlTsvdSUe35ZzdtVRGqYFr0kdGxbfc5gUOkR9RGp20GVKza; path=/; expires=Tue, 07-Apr-2015 18:18:08 GMT; secure; HttpOnly'
        };
        var polling = new eio.transports.websocket({
            path: '/engine.io'
          , hostname: 'localhost'
          , extraHeaders: headers
        });
        expect(polling.extraHeaders).to.equal(headers);
      });
      it('should correctly set them for XMLHttpRequest', function () {
        var headers = {
          'X-Custom-Header-For-My-Project': 'my-secret-access-token',
          'Cookie': 'user_session=NI2JlCKF90aE0sJZD9ZzujtdsUqNYSBYxzlTsvdSUe35ZzdtVRGqYFr0kdGxbfc5gUOkR9RGp20GVKza; path=/; expires=Tue, 07-Apr-2015 18:18:08 GMT; secure; HttpOnly'
        };
        var polling = new eio.transports.polling({
            path: '/engine.io'
          , hostname: 'localhost'
          , extraHeaders: headers
        });
        expect(polling.extraHeaders).to.equal(headers);
      });
    });

    describe('perMessageDeflate', function () {
      it('should set threshold', function (done) {
        var socket = new eio.Socket({ transports: ['websocket'], perMessageDeflate: { threshold: 0 } });
        socket.on('open', function() {
          var ws = socket.transport.ws;
          var send = ws.send;
          ws.send = function(data, opts, callback) {
            ws.send = send;
            ws.send(data, opts, callback);

            expect(opts.compress).to.be(true);
            socket.close();
            done();
          };
          socket.send('hi', { compress: true });
        });
      });

      it('should not compress when the byte size is below threshold', function (done) {
        var socket = new eio.Socket({ transports: ['websocket'] });
        socket.on('open', function() {
          var ws = socket.transport.ws;
          var send = ws.send;
          ws.send = function(data, opts, callback) {
            ws.send = send;
            ws.send(data, opts, callback);

            expect(opts.compress).to.be(false);
            socket.close();
            done();
          };
          socket.send('hi', { compress: true });
        });
      });
    });
  });
}

});
