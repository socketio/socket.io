/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

// abstract
io.Transport = ioClass({

	include: [io.util.Events, io.util.Options],

	init: function(base, options){
		this.base = base;
		this.setOptions(options);
	},

	send: function(){
		throw new Error('Missing send() implementation');  
	},

	connect: function(){
		throw new Error('Missing connect() implementation');  
	},

	disconnect: function(){
		throw new Error('Missing disconnect() implementation');  
	},

	_onData: function(data){
		var msgs;
		if (typeof data === 'string'){
			try {
				msgs = JSON.parse(data);
			} catch(e){}
		} else {
			msgs = data;
		}
		if (msgs && msgs.messages){
		  for (var i = 0, l = msgs.messages.length; i < l; i++){
				this._onMessage(msgs.messages[i]);	
			}
		}
	},

	_onMessage: function(message){
		if (!('sessionid' in this)){
			try {
				var obj = JSON.parse(message);
			} catch(e){}
			if (obj && obj.sessionid){
				this.sessionid = obj.sessionid;
				this._onConnect();
			}				
		} else {	
			this.base._onMessage(message);
		}		
	},

	_onConnect: function(){
		this.connected = true;
		this.base._onConnect();
	},

	_onDisconnect: function(){
		if (!this.connected) return;
		this.connected = false;
		this.base._onDisconnect();
	},

	_prepareUrl: function(){
		return (this.base.options.secure ? 'https' : 'http') 
			+ '://' + this.base.host 
			+ ':' + this.base.options.port
			+ '/' + this.base.options.resource
			+ '/' + this.type
			+ (this.sessionid ? ('/' + this.sessionid) : '/');
	}

});