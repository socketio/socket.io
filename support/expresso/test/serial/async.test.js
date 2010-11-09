
var setup = 0,
    order = [];

module.exports = {
    setup: function(done){
        ++setup;
        done();
    },

    a: function(assert, done){
        assert.equal(1, setup);
        order.push('a');
        setTimeout(function(){
            done();
        }, 500);
    },
    
    b: function(assert, done){
        assert.equal(2, setup);
        order.push('b');
        setTimeout(function(){
            done();
        }, 200);
    },
    
    c: function(assert, done){
        assert.equal(3, setup);
        order.push('c');
        setTimeout(function(){
            done();
        }, 1000);
    },

    d: function(assert){
        assert.eql(order, ['a', 'b', 'c']);
    }
};