this.io = {
  version: 0.1,
	setPath: function(path){
		this.path = path;		
		WebSocket.__swfLocation = path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
	}
};

if ('jQuery' in this) jQuery.io = this.io;