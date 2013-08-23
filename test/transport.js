
describe('Transport', function () {

  describe('public constructors', function () {
    it('should include Transport', function () {
      expect(eio.Transport).to.be.a('function');
    });

    it('should include Polling, WebSocket and FlashSocket', function () {
      expect(eio.transports).to.be.an('object');
      expect(eio.transports.polling).to.be.a('function');
      expect(eio.transports.websocket).to.be.a('function');
      expect(eio.transports.flashsocket).to.be.a('function');
    });
  });

  describe('transport uris', function () {
    it('should generate an http uri', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: false
        , query: { sid: 'test' }
      });
      expect(polling.uri()).to.be('http://localhost/engine.io?sid=test');
    });

    it('should generate an http uri w/o a port', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: false
        , query: { sid: 'test' }
        , port: 80
      });
      expect(polling.uri()).to.be('http://localhost/engine.io?sid=test');
    });

    it('should generate an http uri with a port', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: false
        , query: { sid: 'test' }
        , port: 3000
      });
      expect(polling.uri()).to.be('http://localhost:3000/engine.io?sid=test');
    });

    it('should generate an https uri w/o a port', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , secure: true
        , query: { sid: 'test' }
        , port: 443
      });
      expect(polling.uri()).to.be('https://localhost/engine.io?sid=test');
    });

    it('should generate a timestamped uri', function () {
      var polling = new eio.transports.polling({
          path: '/engine.io'
        , hostname: 'localhost'
        , timestampParam: 't'
        , timestampRequests: true
      });
      expect(polling.uri()).to.match(/http:\/\/localhost\/engine\.io\?t=[0-9]+/);
    });

    it('should generate a ws uri', function () {
      var ws = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: 'test'
        , secure: false
        , query: { transport: 'websocket' }
      });
      expect(ws.uri()).to.be('ws://test/engine.io?transport=websocket');
    });

    it('should generate a wss uri', function () {
      var ws = new eio.transports.websocket({
          path: '/engine.io'
        , hostname: 'test'
        , secure: true
        , query: {}
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
      expect(ws.uri()).to.match(/ws:\/\/localhost\/engine\.io\?woot=[0-9]+/);
    });
  });

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
  });

});
