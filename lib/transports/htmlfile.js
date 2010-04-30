/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

(function(){  
	var empty = new Function, request = io.Transport.XHR.request;

	io.Transport['htmlfile'] = io.Transport.extend({

		type: 'htmlfile',

		connect: function(){
			var self = this;

			this._doc = new ActiveXObject("htmlfile");
			this._doc.open();
			this._doc.write('<html><script>document.domain="'+ document.domain +'"</script></html>');
			this._doc.close();      

			this.iframe = this.doc.createElement('div');
			this._doc.body.appendChild(iframe);
			iframe.innerHTML = '<iframe src="'+ this._prepareUrl() +'"></iframe>';

			this.doc.parentWindow.callback = function(data){ self._onData(data); };      
			window.attachEvent('onunload', function(){ self._destroy(); });
		},

		send: function(data){      
			this._sendXhr = request();
			this._sendXhr.open('POST', this._prepareUrl() + '/send');      
			this._sendXhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');        
			this._sendXhr.send('data=' + encodeURIComponent(data));
		},

		disconnect: function(){
			this._destroy();
			if (this._sendXhr) this._sendXhr.abort();	
			this._onClose();
			this._onDisconnect();
		},

		_destroy: function(){
			this._doc = null;
			CollectGarbage();
		}

	});

	io.Transport['htmlfile'].check = function(){
		return false;
		if ('ActiveXObject' in window){
			try {
				var a = new ActiveXObject('htmlfile');
				return io.Transport.XHR.check();
			} catch(e){}
		}
		return false;
	};

})();