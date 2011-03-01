var Client = require('../client')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , qs = require('querystring');

var NodeClient = module.exports = function(){
  Client.apply(this, arguments);
};

util.inherits(NodeClient, Client);

NodeClient.prototype._onConnect = function(req, res){
  var self = this, body = '', headers = {};
  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.apply(this, [req, res]);
      headers['Content-Type'] = 'multipart/x-mixed-replace;boundary="socketio"';
      headers['Connection'] = 'keep-alive';
      this.request.connection.addListener('end', function(){ self.listener.options.log('[SERVER] _onConnect addListener end called'); self._onClose(); });
      // this.response.useChunkedEncodingByDefault = false; //this breaks the node clientRequest, perhaps Browsers are better in handling this
      this.response.shouldKeepAlive = true;
      this.response.writeHead(200, headers);
      this.response.write("--socketio\r\n");
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
          self.listener.options.log('[SERVER] xhr-multipart message handler error - ' + e.stack);
        }
        res.writeHead(200, headers);
        res.write('ok');
        res.end();
        body = '';
      });
      break;
  }
};
  
NodeClient.prototype._write = function(message){
  if (this._open){
    //socket.io's multipart xhr doesn't send CLRF but just RF. This breaks isaacs multipart.js library so fixed this here. Perhaps browser implementations are more tolerant here
    this.response.write("Content-Type: text/plain" + (message.length === 1 && message.charCodeAt(0) === 6 ? "; charset=us-ascii" : "") + "\r\n\r\n");
    this.response.write(message + "\r\n");
    this.response.write("--socketio");
    //this.response.end();    //we use chunked encoding but do boundary definition over mime
  }
};
