var expect = require('expect.js');
var io = require('../');

describe('connection', function() {
  it('should connect to localhost', function(done) {
    var socket = io();
    socket.on('hi', function(data){
      socket.close();
      done();
    });
  });

  it('should connect to a namespace after connection established', function(done) {
    var manager = io.Manager();
    var socket = manager.socket('/');
    socket.on('connect', function(){
      var foo = manager.socket('/foo');
      foo.on('connect', function(){
        foo.close();
        socket.close();
        done();
      });
    });
  });
});
