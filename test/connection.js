var expect = require('expect.js');
var io = require('../');

describe('connection', function() {
  it('should connect to localhost', function(done) {
    var socket = io();
    socket.on('open', function () {
      socket.on('hi', function (data) {
        socket.close();
        done();
      });
    });
  });
});
