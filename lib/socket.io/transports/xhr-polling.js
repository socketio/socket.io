var Client = require('../client')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , qs = require('querystring');

var Polling = module.exports = function(){
  Client.apply(this, arguments);
};

util.inherits(Polling, Client);

Polling.prototype.getOptions = function(){
  return {
    timeout: null, // no heartbeats
    closeTimeout: 8000,
    duration: 20000
  };
};

Polling.prototype._onConnect = function(req, res){
  var self = this, body = '';
  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.apply(this, [req, res]);
      this._closeTimeout = setTimeout(function(){
        self._write('');
      }, this.options.duration);
      this._payload();
      break;
      
    case 'POST':
      req.addListener('data', function(message){
        body += message;
      });
      req.addListener('end', function(){
        var headers = {'Content-Type': 'text/plain'};
        if (req.headers.origin){
          if (self._verifyOrigin(req.headers.origin)){
            headers['Access-Control-Allow-Origin'] = '*';
            if (req.headers.cookie) headers['Access-Control-Allow-Credentials'] = 'true';
          } else {
            res.writeHead(401);
            res.write('unauthorized');
            res.end();
            return;
          }
        }
        try {
          // optimization: just strip first 5 characters here?
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){}
        res.writeHead(200, headers);
        res.write('ok');
        res.end();
      });
      break;
  }
};

Polling.prototype._onClose = function(){
  if (this._closeTimeout) clearTimeout(this._closeTimeout);
  return Client.prototype._onClose.call(this);
};
  
Polling.prototype._write = function(message){
  if (this._open){
    var headers = {'Content-Type': 'text/plain; charset=UTF-8', 'Content-Length': Buffer.byteLength(message)};
    // https://developer.mozilla.org/En/HTTP_Access_Control
    if (this.request.headers.origin && this._verifyOrigin(this.request.headers.origin)){
      headers['Access-Control-Allow-Origin'] = this.request.headers.origin;
      if (this.request.headers.cookie) headers['Access-Control-Allow-Credentials'] = 'true';
    }
    this.response.writeHead(200, headers);
    this.response.write(message);
    this.response.end();
    this._onClose();
  }
};
