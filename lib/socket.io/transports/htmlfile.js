var Client = require('../client')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , qs = require('querystring');

var HTMLFile = module.exports = function(){
  Client.apply(this, arguments);
};

util.inherits(HTMLFile, Client);
  
HTMLFile.prototype._onConnect = function(req, res){
  var self = this, body = '';
  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.call(this, req, res);
      this.response.useChunkedEncodingByDefault = true;
      this.response.shouldKeepAlive = true;
      this.response.writeHead(200, {
        'Content-Type': 'text/html',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
      });
      this.response.write('<html><body>' + new Array(245).join(' '));
      this._payload();
      break;
      
    case 'POST':
      req.addListener('data', function(message){
        body += message;
      });
      req.addListener('end', function(){
        try {
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){}
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('ok');
        res.end();
      });
      break;
  }
};
  
HTMLFile.prototype._write = function(message){
  if (this._open)
    this.response.write('<script>parent.s._('+ JSON.stringify(message) +', document);</script>'); //json for escaping
};
