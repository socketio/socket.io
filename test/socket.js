var expect = require('expect.js');
var eio = require('../');
var hasCORS = require('has-cors');

describe('Socket', function () {

  this.timeout(10000);

  describe('filterUpgrades', function () {
    it('should return only available transports', function () {
      var socket = new eio.Socket({'transports': ['polling']});
      expect(socket.filterUpgrades(['polling','websocket'])).to.eql(['polling']);
    });
  });

});
