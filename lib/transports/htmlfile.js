/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

io.Transport.htmlfile = io.Transport.extend({

	type: 'htmlfile',

	connect: function(){
		var self = this;
		this._open();
		window.attachEvent('onunload', function(){ self._destroy(); });
	},
	
	_open: function(){
		this._doc = new ActiveXObject('htmlfile');
		this._doc.open();
		this._doc.write('<html></html>');
		this._doc.parentWindow.s = this;
		this._doc.close();
		
		var _iframeC = this._doc.createElement('div');
		this._doc.body.appendChild(_iframeC);
		this._iframe = this._doc.createElement('iframe');
		_iframeC.appendChild(this._iframe);
		this._iframe.src = this._prepareUrl() + '/' + (+ new Date);
	},
	
	_: function(data, doc){
		this._onData(data);
		var script = doc.getElementsByTagName('script')[0];
		script.parentNode.removeChild(script);
	},
	
	_destroy: function(){
		this._iframe.src = 'about:blank';
		this._doc = null;
		CollectGarbage();
	},
	
	send: function(data){
		this._sendXhr = io.Transport.XHR.request();
		this._sendXhr.open('POST', this._prepareUrl() + '/send');
		this._sendXhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
		this._sendXhr.send('data=' + encodeURIComponent(data));
	},

	disconnect: function(){
		this._destroy();
		if (this._sendXhr) this._sendXhr.abort();	
		this._onClose();
		this._onDisconnect();
	}

});

io.Transport.htmlfile.check = function(){
	if ('ActiveXObject' in window){
		try {
			var a = new ActiveXObject('htmlfile');
			return io.Transport.XHR.check();
		} catch(e){}
	}
	return false;
};

io.Transport.htmlfile.xdomainCheck = function(){
	return false; // send() is not cross domain. we need to POST to an iframe to fix it
};