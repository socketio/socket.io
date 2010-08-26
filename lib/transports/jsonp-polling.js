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
	var self = this,
			form = document.createElement('FORM'),
			iframe = document.createElement('IFRAME'),
			area = document.createElement('TEXTAREA');
	iframe.name = 'socket_io_iframe_' + this._index;
	iframe.src = 'about:blank';
	iframe.onload = function(){
		form.parentNode.removeChild(form);
		self._posting = false;
		self._checkSend();
	};
	form.style.position = 'absolute';
	form.style.top = '-1000px';
	form.style.left = '-1000px';
	form.target = iframe.name;
	form.method = 'POST';
	form.src = this._prepareUrl() + '/' + (+new Date) + '/' + this._index;
	area.name = 'data';
	area.value = data;
	form.appendChild(area);
	form.appendChild(iframe);
	this._posting = true;
	this._insertAt.parentNode.insertBefore(form, this._insertAt);
	form.submit();
};

JSONPPolling.prototype._get = function(){
	var self = this,
			script = this._script = document.createElement('SCRIPT');
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