/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

io.Transport['xhr-multipart'] = io.Transport.XHR.extend({

	type: 'xhr-multipart',

	connect: function(){
		var self = this;
		this._xhr = this._request('', 'GET', true);
		this._xhr.onreadystatechange = function(){
			if (self._xhr.readyState == 3) self._onData(self._xhr.responseText);
		};
		this._xhr.send();
	}

});

io.Transport['xhr-multipart'].check = function(){
	return 'XMLHttpRequest' in window && 'multipart' in XMLHttpRequest.prototype;
};