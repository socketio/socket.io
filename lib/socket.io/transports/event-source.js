/**
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
 
/**
 * Module dependencies.
 */
var Client = require('../client')
  , util = require(process.binding('natives').util ? 'util' : 'sys')
  , qs = require('querystring');

/**
 * Exports `event-source` as the module. The `event-source` module is based
 * on the Server Send Events HTML5 specification <http://dev.w3.org/html5/eventsource/>.
 * For legacy support see Opera's blog entry: <http://labs.opera.com/news/2006/09/01/>.
 * 
 * @constructor
 * @extends {Client}
 * @api public
 */
var ES = module.exports = function(){
  Client.apply(this, arguments);
};

util.inherits(ES, Client);
  
/**
 * GET requests:
 *
 * Estable a persistent connection between the server and the client.
 * We determing with what specification we are working with by checking for
 * the `legacy` path in the request.url. This check is required because we
 * need to send a different content-type header.
 *
 * POST requests:
 *
 * Handle the request as fast as possible parse out the body and forward
 * it to the `_onMessage` handler. 
 *
 * @param {http.ServerRequest} req Request.
 * @param {http.ServerResponse} res Response.
 * @api private
 */
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
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('ok');
        res.end();
        
        try {
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){
          self.listener.options.log('ES message handler error - ' + e.stack);
        }
      });
      break;
  }
};
  
/**
 * Writes messages to the established connection.
 *
 * @param {String} message The message that needs to be send to the server
 * @api private
 */
ES.prototype._write = function(message){
  if (this._open){
    if (!this.legacy){
      this.response.write('data:'+ message +'\n\n');
    } else {
      this.response.write('Event: io\ndata: '+ message +'\n\n');
    }
    
  }
};
