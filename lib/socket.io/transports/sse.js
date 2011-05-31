var Client = require('../client')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , qs = require('querystring');

var SSE = module.exports = function(){
  Client.apply(this, arguments);
};

util.inherits(SSE, Client);

SSE.prototype._onConnect = function(req, res){
  var self = this, body = '', headers = {};
  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.apply(this, [req, res]);
      headers['Content-Type'] = 'text/event-stream';
      headers['Connection'] = 'keep-alive';
      headers['Cache-Control'] = 'no-cache';
      this.request.connection.addListener('end', function(){ self._onClose(); });
      this.response.useChunkedEncodingByDefault = false;
      this.response.shouldKeepAlive = true;
      this.response.writeHead(200, headers);
      if ('flush' in this.response) this.response.flush();
      this._payload();
      break;
    case 'POST':
      headers['Content-Type'] = 'text/plain';
      req.addListener('data', function(message){
        body += message.toString();
      });
      req.addListener('end', function(){
        try {
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){
          self.listener.options.log('sse message handler error - ' + e.stack);
        }
        res.writeHead(200, headers);
        res.write('ok');
        res.end();
        body = '';
      });
      break;
  }
};

SSE.prototype._write = function(message){
  if (this._open){
    this.response.write("data:" + message + "\n\n");
  }
};
