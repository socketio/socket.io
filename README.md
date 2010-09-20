socket.io
=========

#### Sockets for the rest of us

The `socket.io` client is basically a simple HTTP Socket interface implementation. It allows you to establish a realtime connection with a server (see `socket.io` server [here](http://github.com/LearnBoost/Socket.IO-node)), hiding the complexity of the different transports (WebSocket, Flash, forever iframe, XHR long polling, XHR multipart encoded, etc), while retaining a WebSocket-like API:

	socket = new io.Socket('localhost');
	socket.connect();
	socket.on('connect', function(){
		// connected
	});
	socket.on('message', function(data){
		// data here
	});
	socket.send('some data');

### Features

- Supports 
	- WebSocket
	- Adobe Flash Socket
	- ActiveX HTMLFile (IE)
	- XHR with multipart encoding
	- XHR with long-polling
	- JSONP polling (for cross-domain)

- Tested on
	- Safari 4
	- Google Chrome 5
	- Internet Explorer 6
	- Internet Explorer 7
	- Internet Explorer 8
	- iPhone Safari
	- iPad Safari
	- Firefox 3
	- Firefox 4 (Minefield)
	- Opera 10.61
	
- ActionScript Socket is known not to work behind proxies, as it doesn't have access to the user agent proxy settings to implement the CONNECT HTTP method. If it fails, `socket.io` will try something else.
	
- On a successful connection, it remembers the transport for next time (stores it in a cookie).

- Small. Closure Compiled with all deps: 5.82kb (gzipped).

- Easy to use! See [socket.io-node](http://github.com/LearnBoost/Socket.IO-node) for the server to connect to.

### How to use
	
The recommended way of including the Socket.IO client is through the Socket.IO CDN:

In your &lt;head&gt;

	<script src="http://cdn.socket.io/stable/socket.io.js"></script>

Then, in your code

	socket = new io.Socket('localhost');
	socket.connect();
	socket.send('some data');
	socket.on('message', function(data){
		alert('got some data' + data);
	});
	
For an example, check out the chat [source](https://github.com/LearnBoost/Socket.IO-node/blob/master/test/chat.html).

### Notes

If you are serving you .swf from a other domain than socket.io.js you will need to change the WEB_SOCKET_SWF_LOCATION to the insecure version.

	<script>WEB_SOCKET_SWF_LOCATION = '/path/to/WebSocketMainInsecure.swf';</script>

The insecure version can be found [here](http://github.com/gimite/web-socket-js/blob/master/WebSocketMainInsecure.zip).

IMPORTANT! When checking out the git repo, make sure to include the submodules. One way to do it is:

	git clone [repo] --recursive
  
Another, once cloned

	git submodule update --init --recursive

### Documentation 

#### io.Socket

	new io.Socket(host, [options]);

Options:

- *port*

		Current port or 80
	
	The port `socket.io` server is attached to (defaults to the document.location port)

- *resource*

		socket.io

  The resource is what allows the `socket.io` server to identify incoming connections by `socket.io` clients. In other words, any HTTP server can implement socket.io and still serve other normal, non-realtime HTTP requests.

- *transports*

		['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling']

	A list of the transports to attempt to utilize (in order of preference)
	
- *transportOptions*
	
		{
			someTransport: {
				someOption: true
			},
			...
		}
				
	An object containing (optional) options to pass to each transport.

Properties:

- *options*

	The passed in options combined with the defaults

- *connected*

	Whether the socket is connected or not.
	
- *connecting*

	Whether the socket is connecting or not.
	
- *transport*	

	The transport instance.

Methods:
	
- *connect*

	Establishes a connection	
	
- *send(message)*
	
	A string of data to send.
	
- *disconnect*

	Closes the connection
	
- *on(event, λ)*

	Adds a listener for the event *event*
	
- *removeEvent(event, λ)*

	Removes the listener λ for the event *event*
	
Events:

- *connect*

	Fired when the connection is established and the handshake successful
	
- *message(message)*
	
	Fired when a message arrives from the server

- *close*

	Fired when the connection is closed. Be careful with using this event, as some transports will fire it even under temporary, expected disconnections (such as XHR-Polling).
	
- *disconnect*

	Fired when the connection is considered disconnected.

### Changelog

2010 08 02 - **0.5.4** (9.95KB)

* Added io.util.load as a reusable onload handler
* Added io.util.ios which reports if the UA is running on iPhone or iPad
* No more loading bar on iPhone: XHR-Polling now connects `onload` for the iOS WebKit, and waits 10 ms to launch the initial connection.

### Credits

Guillermo Rauch &lt;guillermo@learnboost.com&gt;

### License 

(The MIT License)

Copyright (c) 2010 LearnBoost &lt;dev@learnboost.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.