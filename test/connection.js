var expect = require('expect.js');
var io = require('../');

describe('connection', function() {
  this.timeout(10000);

  it('should connect to localhost', function(done) {
    var socket = io();
    socket.on('hi', function(data){
      socket.close();
      done();
    });
  });
});
