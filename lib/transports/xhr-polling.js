/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){

	var empty = new Function(),

	XHRPolling = io.Transport['xhr-polling'] = function(){
		io.Transport.XHR.apply(this, arguments);
	};

	io.util.inherit(XHRPolling, io.Transport.XHR);

	XHRPolling.prototype.type = 'xhr-polling';

	XHRPolling.prototype.connect = function(){
		if (io.util.ios || io.util.android){
			var self = this;
			io.util.load(function(){
				setTimeout(function(){
					io.Transport.XHR.prototype.connect.call(self);
				}, 10);
			});
		} else {
			io.Transport.XHR.prototype.connect.call(this);
		}
	};

	XHRPolling.prototype._get = function(){
		var self = this;
		this._xhr = this._request(+ new Date, 'GET');
    this._xhr.onreadystatechange = function(){
      var status;
      if (self._xhr.readyState == 4){
        self._xhr.onreadystatechange = empty;
        try { status = self._xhr.status; } catch(e){}
        if (status == 200){
          self._onData(self._xhr.responseText);
          self._get();
        } else {
          self._onDisconnect();
        }
      }
    };
		this._xhr.send(null);
	};

	XHRPolling.check = function(){
		return io.Transport.XHR.check();
	};

	XHRPolling.xdomainCheck = function(){
		return io.Transport.XHR.xdomainCheck();
	};

})();
