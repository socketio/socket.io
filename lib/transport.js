/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

// abstract

(function(){
	
	var frame = '\ufffdm\ufffd',
	
	Transport = io.Transport = function(base, options){
		this.base = base;
		this.options = options;
	};

	Transport.prototype.send = function(){
		throw new Error('Missing send() implementation');
	};

	Transport.prototype.connect = function(){
		throw new Error('Missing connect() implementation');
	};

	Transport.prototype.disconnect = function(){
		throw new Error('Missing disconnect() implementation');
	};
	
	Transport.prototype._decode = function(data){
		if (data.substr(0, 3) !== frame) return false;
		var messages = [];
		do {
			for (var i = 0, n, number = '';; i++){
				var n = data.substr(i, 1);
				if (n === frame){
					number = Number(number);
					break;
				}
				number += n;
			}
			messages.push(data.substr(i, i + number)); // here
			data = data.substr(i + number);
		} while(data !== '');
		return messages;
	};
	
	Transport.prototype._onData = function(data){
		var msgs = this._decode(data);
		if (msgs){
		  for (var i = 0, l = msgs.length; i < l; i++){
				this._onMessage(msgs.messages[i]);
			}
		}
	};
	
	Transport.prototype._onMessage = function(message){
		if (!('sessionid' in this)){
			this.sessionid = message;
			this._onConnect();
		} else if (message.substr(0, 3) == '\ufffdh\ufffd'){
			this.onHeartbeat(message.substr(3));
		} else {
			this.base._onMessage(message);
		}
	},
	
	Transport.prototype._onHeartbeat = function(heartbeat){
		this.send('\ufffdh\ufffd' + heartbeat); // echo
	};
	
	Transport.prototype._onConnect = function(){
		this.connected = true;
		this.base._onConnect();
	};

	Transport.prototype._onDisconnect = function(){
		if (!this.connected) return;
		this.connected = false;
		this.base._onDisconnect();
	};

	Transport.prototype._prepareUrl = function(){
		return (this.base.options.secure ? 'https' : 'http') 
			+ '://' + this.base.host 
			+ ':' + this.base.options.port
			+ '/' + this.base.options.resource
			+ '/' + this.type
			+ (this.sessionid ? ('/' + this.sessionid) : '/');
	};

})();