io.Transport['xhr-multipart'] = io.Transport.XHR.extend({

  type: 'xhr-multipart',

  connect: function(){
    var self = this;
    this._xhr = this._request('', 'GET', true);
    this._xhr.onreadystatechange = function(){
      if (self._xhr.readyState == 3) self._onData(self._xhr.responseText);
      else if (self._xhr.status == 200 && self._xhr.readyState == 4) self.connect(); 
    };
    this._xhr.send();
  }

});

io.Transport['xhr-multipart'].check = function(){
  return 'XMLHttpRequest' in window && (/Gecko|Webkit/).test(navigator.userAgent);
};