/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

(function(){

	var empty = new Function();

	io.Transport['xhr-polling'] = io.Transport.XHR.extend({

		type: 'xhr-polling',

		connect: function(){
			var self = this;
			this._xhr = this._request('', 'GET');
			this._xhr.onreadystatechange = function(){
				if (self._xhr.status == 200 && self._xhr.readyState == 4){
					if (self._xhr.responseText.length) self._onData(self._xhr.responseText);
					self._xhr.onreadystatechange = empty;
					self.connect();
				}
			};
			this._xhr.send();
		}

	});

	io.Transport['xhr-polling'].check = function(){
		return io.Transport.XHR.check();
	};

})();