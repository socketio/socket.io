var io = require('socket.io')
  , assert = require('assert')
  , Listener = io.Listener;

module.exports = {

  'test server initialization': function(){
    var _server = require('http').createServer(function(){})
      , _socket = io.listen(_server, { log: null });
    assert.ok(_socket instanceof Listener);
    _server.listen(7000, function(){
      setTimeout(function(){
        _server.close();
      }, 100);
    })
  }

};
