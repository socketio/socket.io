
/**
 * Module dependencies.
 */

var http = require('http');

var server = http.createServer(function(req, res){
    if (req.method === 'GET') {
        if (req.url === '/delay') {
            setTimeout(function(){
                res.writeHead(200, {});
                res.end('delayed');
            }, 200);
        } else {
            var body = JSON.stringify({ name: 'tj' });
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf8',
                'Content-Length': body.length
            });
            res.end(body);
        }
    } else {
        var body = '';
        req.setEncoding('utf8');
        req.addListener('data', function(chunk){ body += chunk });
        req.addListener('end', function(){
            res.writeHead(200, {});
            res.end(req.url + ' ' + body);
        });
    }
});

module.exports = {
    'test assert.response()': function(assert, beforeExit){
        var called = 0;

        assert.response(server, {
            url: '/',
            method: 'GET'
        },{
            body: '{"name":"tj"}',
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf8'
            }
        });
        
        assert.response(server, {
            url: '/foo',
            method: 'POST',
            data: 'bar baz'
        },{
            body: '/foo bar baz',
            status: 200
        }, function(res){
            ++called;
            assert.ok(res);
        });
        
        assert.response(server, {
            url: '/foo'
        }, function(res){
            ++called;
            assert.ok(res.body.indexOf('tj') >= 0, 'Test assert.response() callback');
        });
        
        assert.response(server,
            { url: '/delay', timeout: 300 },
            { body: 'delayed' });
        
        beforeExit(function(){
            assert.equal(2, called);
        });
    },
    
    'test assert.response() regexp': function(assert){
      assert.response(server,
        { url: '/foo', method: 'POST', data: 'foobar' },
        { body: /^\/foo foo(bar)?/ });
    }
};