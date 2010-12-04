var merge = require('socket.io/utils').merge;

module.exports = {

  'test that merging an object works': function(assert){
    var a = { a: 'b', c: 'd' }
      , b = { c: 'b' };
    assert.ok(merge(a,b).a === 'b');
    assert.ok(merge(a,b).c === 'b');
  }

}
