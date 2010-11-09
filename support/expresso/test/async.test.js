
setTimeout(function(){
    exports['test async exports'] = function(assert){
        assert.ok('wahoo');
    };
}, 100);