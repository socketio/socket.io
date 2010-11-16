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

2010 11 01 - **0.6.0** 

* Make sure to only destroy if the _iframe was created
* Removed flashsocket onClose logic since its handled by connectTimeout
* Added socket checks when disconnecting / sending messages
* Fixed semicolons (thanks SINPacifist)
* Added io.util.merge for options merging. Thanks SINPacifist
* Removed unnecessary onClose handling, since this is taken care by Socket (thanks SINPacifist)
* Make sure not to try other transports if the socket.io cookie was there
* Updated web-socket-js
* Make sure not to abort the for loop when skipping the transport
* Connect timeout (fixes #34)
* Try different transports upon connect timeout (fixes #35)
* Restored rememberTransport to default
* Removed io.setPath check
* Make sure IE7 doesn't err on the multipart feature detection. Thanks Davin Lunz
* CORS feature detection. Fixes IE7 attempting cross domain requests through their incomplete XMLHttpRequest implementation.
* Now altering WEB_SOCKET_SWF_LOCATION (this way we don't need the web-socket-js WebSocket object to be there)
* Flashsocket .connect() and .send() call addTask.
* Make sure flashsocket can only be loaded on browsers that don't have a native websocket
* Leveraging __addTask to delay sent messages until WebSocket through SWF is fully loaded.
* Removed __isFlashLite check
* Leverage node.js serving of the client side files
* Make sure we can load io.js from node (window check)
* Fix for XDomain send() on IE8 (thanks Eric Zhang)
* Added a note about cross domain .swf files
* Made sure no errors where thrown in IE if there isn't a flash fallback available.
* Make sure disconnect event is only fired if the socket was completely connected, and it's not a reconnection attempt that was interrupted.
* Force disconnection if .connect() is called and a connection attempt is ongoing
* Upon socket disconnection, also mark `connecting` as false
* .connecting flag in transport instance
* Make sure .connecting is cleared in transport
* Correct sessionid checking
* Clear sessionid upon disconnection
* Remove _xhr and _sendXhr objects
* Moved timeout default into Transport
* Remove callbacks on _onDisconnect and call abort()
* Added placeholder for direct disconnect in XHR
* Timeout logic (fixes #31)
* Don't check for data length to trigger _onData, since most transports are not doing it
* Set timeout defaults based on heartbeat interval and polling duration (since we dont do heartbeats for polling)
* Check for msgs.length _onData
* Removed unused client option (heartbeatInterval)
* Added onDisconnect call if long poll is interrupted
* Polling calls _get directly as opposed to connect()
* Disconnection handling upon failure to send a message through xhr-* transports.
* Clean up internal xhr buffer upon disconnection
* Clean up general buffer in Socket upon disconnection
* Mark socket as disconnected
* Opera 10 support
* Fix for .fire on IE being called without arguments (fixes #28)
* JSONP polling transport
* Android compatibility.
* Automatic JSON decoding support
* Automatic JSON encoding support for objects
* Adding test for android for delaying the connection (fixes spinner)
* Fixing a few dangerous loops that otherwise loop into properties that have been added to the prototype elsewhere.
* Support for initializing io.Socket after the page has been loaded

2010 11 ?? - **0.7.0**

* Fixed, improved and added missing Transport#disconnect methods
* Implemented data.js (data and message encoding and decoding with buffering)
  - Fixes edge cases with multipart not sending the entirety of a message and
    firing the data event
* Implemented forced disconnect call from server
* Added warning if JSON.parse is not available and a JSON message is received

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
