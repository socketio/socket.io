var expect = require('expect.js');
var eio = require('../');

describe('connection', function() {
  it('should connect to localhost', function(done) {
    var socket = new eio.Socket();
    socket.on('open', function () {
      socket.on('message', function (data) {
        expect(data).to.equal('hi');
        done();
      });
    });
  });
});
