var Client = require('../client')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , qs = require('querystring');

var Multipart = module.exports = function(){
  Client.apply(this, arguments);
};

util.inherits(Multipart, Client);

Multipart.prototype._onConnect = function(req, res){
  var self = this, body = '', headers = {};
  // https://developer.mozilla.org/En/HTTP_Access_Control
  if (req.headers.origin && this._verifyOrigin(req.headers.origin)){
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  if (typeof req.headers['access-control-request-method'] !== 'undefined'){
    // CORS preflight message
    headers['Access-Control-Allow-Methods'] = req.headers['access-control-request-method'];
    res.writeHead(200, headers);
    res.write('ok');
    res.end();
    return;
  }
  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.apply(this, [req, res]);
      headers['Content-Type'] = 'multipart/x-mixed-replace;boundary="socketio"';
      headers['Connection'] = 'keep-alive';
      this.request.connection.addListener('end', function(){ self._onClose(); });
      this.response.useChunkedEncodingByDefault = false;
      this.response.shouldKeepAlive = true;
      this.response.writeHead(200, headers);
      this.response.write("--socketio\n");
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
          self.listener.options.log('xhr-multipart message handler error - ' + e.stack);
        }
        res.writeHead(200, headers);
        res.write('ok');
        res.end();
        body = '';
      });
      break;
  }
};
  
Multipart.prototype._write = function(message){
  if (this._open){
    this.response.write("Content-Type: text/plain" + (message.length === 1 && message.charCodeAt(0) === 6 ? "; charset=us-ascii" : "") + "\n\n");
    this.response.write(message + "\n");
    this.response.write("--socketio\n");
  }
};
