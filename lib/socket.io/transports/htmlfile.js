var Client = require('../client')
  , qs = require('querystring');

var HTMLFile = module.exports = function(){
  Client.apply(this, arguments);
};

require('sys').inherits(HTMLFile, Client);
  
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
          self._onData(msg.data);
        } catch(e){}
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('ok');
        res.end();
      });
  }
};
  
HTMLFile.prototype._write = function(msg){
  if (this._open){
    if (this._verifyOrigin(this.request.headers.origin))
      // we leverage json for escaping
      msg = '<script>parent.s._('+ JSON.stringify(msg) +', document);</script>';
    else
      msg = "<script>alert('Cross domain security restrictions not met');</script>";
    this.response.write(msg);
  }
};
