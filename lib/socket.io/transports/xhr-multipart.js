var Client = require('../client').Client, 
		qs = require('querystring');

this['xhr-multipart'] = Client.extend({
	
	_onConnect: function(req, res){
		var self = this;
		switch (req.method){
			case 'GET':
				var self = this;					
				this.request.addListener('end', function(){
					if (!('hijack' in self.connection)){
						throw new Error('You have to patch Node! Please refer to the README');
					}

					self.connection.addListener('end', function(){ self._onClose(); });				
					self.connection.hijack();
					self.connection.setTimeout(0);
					self.response.use_chunked_encoding_by_default = false;
				});
				
				this.response.writeHead(200, {
					'Content-type': 'multipart/x-mixed-replace;boundary=socketio'
				});
				this.response.write("--socketio\r\n");
				this.response.flush();
				
				this._payload();
				break;
				
			case 'POST':
				req.addListener('data', function(message){
					try {
						var msg = qs.parse(message);
						self._onMessage(msg.data);
					} catch(e){}			
					res.writeHead(200);
					res.write('ok');
					res.close();
				});
				break;
		}
	},
	
	_write: function(message){
		this.response.write("Content-type: text/plain\r\n");
		this.response.write(message);
		this.response.write("\r\n--socketio\r\n");
	}
	
});