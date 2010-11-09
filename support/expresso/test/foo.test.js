
/**
 * Module dependencies.
 */

var foo = require('foo');

module.exports = {
    'foo()': function(assert){
        assert.equal('foo', foo.foo());
        assert.equal('foo', foo.foo());
    }
};