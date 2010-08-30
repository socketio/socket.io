/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

io.JSONP = [];

JSONPPolling = io.Transport['jsonp-polling'] = function(){
	io.Transport.XHR.apply(this, arguments);
	this._insertAt = document.getElementsByTagName('script')[0];
	this._index = io.JSONP.length;
	io.JSONP.push(this);
};

io.util.inherit(JSONPPolling, io.Transport['xhr-polling']);

JSONPPolling.prototype.type = 'jsonp-polling';

JSONPPolling.prototype._send = function(data){
	var self = this;
	if (!('_form' in this)){
		var form = document.createElement('FORM'),
		    area = document.createElement('TEXTAREA'),
		    id = this._iframeId = 'socket_io_iframe_' + this._index,
		    iframe;

		form.style.position = 'absolute';
		form.style.top = '-1000px';
		form.style.left = '-1000px';
		form.target = id;
		form.method = 'POST';
		form.action = this._prepareUrl() + '/' + (+new Date) + '/' + this._index;
		area.name = 'data';
		form.appendChild(area);
		this._insertAt.parentNode.insertBefore(form, this._insertAt);
		document.body.appendChild(form);

		this._form = form;
		this._area = area;
	}

	function complete(){
		initIframe();
		self._posting = false;
		self._checkSend();
	};

	function initIframe(){
		if (self._iframe){
			self._form.removeChild(self._iframe);
		} 

		try {
			// ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
			iframe = document.createElement('<iframe name="'+ self._iframeId +'">');
		} catch(e){
			iframe = document.createElement('iframe');
			iframe.name = self._iframeId;
		}

		iframe.id = self._iframeId;

		self._form.appendChild(iframe);
		self._iframe = iframe;
	};

	initIframe();

	this._posting = true;
	this._area.value = data;

	try {
		this._form.submit();
	} catch(e){}

	if (this._iframe.attachEvent){
		iframe.onreadystatechange = function(){
			if (self._iframe.readyState == 'complete') complete();
		};
	} else {
		this._iframe.onload = complete;
	}
};

JSONPPolling.prototype._get = function(){
	var self = this,
			script = document.createElement('SCRIPT');
	if (this._script){
		this._script.parentNode.removeChild(this._script);
		this._script = null;
	}
	script.async = true;
	script.src = this._prepareUrl() + '/' + (+new Date) + '/' + this._index;
	script.onerror = function(){
		self._onDisconnect();
	};
	this._insertAt.parentNode.insertBefore(script, this._insertAt);
	this._script = script;
};

JSONPPolling.prototype._ = function(){
	this._onData.apply(this, arguments);
	this._get();
	return this;
};

JSONPPolling.check = function(){
	return true;
};

JSONPPolling.xdomainCheck = function(){
	return true;
};