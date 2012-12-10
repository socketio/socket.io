
var Emitter = require('../lib/emitter');
var expect = require('expect.js');

describe('emitter', function(){

  it('should return handles for subs', function(){
    var e = new Emitter;
    var c = 0;
    var h1 = e.on('test', function(){
      c++;
    });
    var h2 = e.on('test', function(){
      c--;
    });
    e.emit('test');
    e.emit('test');
    h2.destroy();
    expect(c).to.be(0);
    e.emit('test');
    e.emit('test');
    expect(c).to.be(2);
  });

});
