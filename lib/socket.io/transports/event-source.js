var Client = require('../client')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , qs = require('querystring');

var ES = module.exports = function(){
  Client.apply(this, arguments);
};

util.inherits(ES, Client);
  
ES.prototype._onConnect = function(req, res){
  var self = this, body = '';
  
  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.call(this, req, res);
      this.response.useChunkedEncodingByDefault = true;
      this.response.shouldKeepAlive = true;
      this.legacy = /\/legacy\/$/.test( req.url );
      this.response.writeHead(200, {
        'Content-Type': !this.legacy ? 'text/event-stream' : 'application/x-dom-event-stream',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
      });
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
        } catch(e){
          self.listener.options.log('ES message handler error - ' + e.stack);
        }
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('ok');
        res.end();
      });
      break;
  }
};
  
ES.prototype._write = function(message){
  if (this._open){
    if (!this.legacy){
      this.response.write('data:'+ message +'\n\n');
    } else {
      this.response.write('Event: io\ndata: '+ message +'\n\n');
    }
    
  }
};
