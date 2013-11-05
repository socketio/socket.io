
var expect = require('expect.js');
var eio = require('../');

describe('engine.io-client', function () {

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

});
