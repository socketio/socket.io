
/**
 * Module dependencies.
 */

var bar = require('bar');

module.exports = {
    'bar()': function(assert){
        assert.equal('bar', bar.bar());
    }
};