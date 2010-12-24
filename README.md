Socket.IO Server: Sockets for the rest of us
============================================

The `Socket.IO` server provides seamless support for a variety of transports intended for realtime communication.

- WebSocket 
- WebSocket over Flash (+ XML security policy support)
- XHR Polling
- XHR Multipart Streaming
- Forever Iframe
- JSONP Polling (for cross domain)

## Requirements

- Node v0.1.103+ with `crypto` module support (make sure you have OpenSSL
  headers when installing Node to get it)
- The [Socket.IO client](http://github.com/LearnBoost/Socket.IO), to connect from the browser

## How to use

To run the demo, execute the following:

	git clone git://github.com/LearnBoost/Socket.IO-node.git socket.io
	cd socket.io/example/
	sudo node server.js

and point your browser to `http://localhost:8080`. In addition to `8080`, if the transport `flashsocket` is enabled, a server will be initialized to listen for requests on port `843`.

### Implementing it on your project

`Socket.IO` is designed not to take over an entire port or Node `http.Server` instance. This means that if you choose to have your HTTP server listen on port `80`, `socket.io` can intercept requests directed to it, and normal requests will still be served.

By default, the server will intercept requests that contain `socket.io` in the path / resource part of the URI. You can change this as shown in the available options below.

On the server:

	var http = require('http'), 
			io = require('./path/to/socket.io'),
			
	server = http.createServer(function(req, res){
		// your normal server code
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end('<h1>Hello world</h1>');
	});
	
	server.listen(80);
			
	// socket.io, I choose you
	var socket = io.listen(server);
	
	socket.on('connection', function(client){
	  // new client is here!
	  client.on('message', function(){ … })
	  client.on('disconnect', function(){ … })
	});
	
On the client:

	<script src="/socket.io/socket.io.js"></script>
	<script>
		var socket = new io.Socket();
		socket.connect();
		socket.on('connect', function(){ … })
		socket.on('message', function(){ … })
		socket.on('disconnect', function(){ … })
	</script>

The [client-side](http://github.com/learnboost/socket.io) files are served automatically by `Socket.IO-node`.

## Documentation

### Listener

	io.listen(<http.Server>, [options])
	
Returns: a `Listener` instance
	
Public Properties:

- *server*

	An instance of _process.http.Server_.
	
- *options*

	The passed-in options, combined with the defaults.
	
- *clients*
	
	An object of clients, indexed by session ID.
	
Methods:

- *addListener(event, λ)*

	Adds a listener for the specified event. Optionally, you can pass it as an option to `io.listen`, prefixed by `on`. For example: `onClientConnect: function(){}`
	
- *removeListener(event, λ)*	

	Removes a listener from the listener array for the specified event.
	
- *broadcast(message, [except])*

	Broadcasts a message to all clients. Optionally, you can pass a single session ID or array of session IDs to avoid broadcasting to, as the second argument.
	
Options:
	
- *resource*

		socket.io

  The resource is what allows the `socket.io` server to identify incoming connections from `socket.io` clients. Make sure they're in sync.
  
- *flashPolicyServer*

		true
		
	Create a Flash Policy file server on port `843` (this is restricted port and you will need to have root permission). If you disable the FlashPolicy file server, Socket.IO will automatically fall back to serving the policy file inline.
		

- *transports*

		['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling',
    'jsonp-polling']
		
	A list of the accepted transports.
	
- *transportOptions*
	
	An object of options to pass to each transport. For example `{ websocket: { closeTimeout: 8000 }}`
	
- *log*
	
		ƒ(){ sys.log }
		
	The logging function. Defaults to outputting to `stdout` through `sys.log`

Events:
	
- *clientConnect(client)*
	
	Fired when a client is connected. Receives the Client instance as parameter.
	
- *clientMessage(message, client)*

	Fired when a message from a client is received. Receives the message and Client instance as parameters.
	
- *clientDisconnect(client)*

	Fired when a client is disconnected. Receives the Client instance as a parameter.

Important note: `this` in the event listener refers to the `Listener` instance.

### Client
	
	Client(listener, req, res)
	
Public Properties:

- *listener*

	The `Listener` instance to which this client belongs.

- *connected*

	Whether the client is connected.
	
- *connections*

	Number of times the client has connected.
	
Methods:

- *send(message)*

	Sends a message to the client.
	
- *broadcast(message)*

	Sends a message to all other clients. Equivalent to Listener::broadcast(message, client.sessionId).

## Protocol

One of the design goals is that you should be able to implement whatever protocol you desire without `Socket.IO` getting in the way. `Socket.IO` has a minimal, unobtrusive protocol layer, consisting of two parts:

* Connection handshake
	
	This is required to simulate a full duplex socket with transports such as XHR Polling or Server-sent Events (which is a "one-way socket"). The basic idea is that the first message received from the server will be a JSON object that contains a session ID used for further communications exchanged between the client and server. 
	
	The concept of session also naturally benefits a full-duplex WebSocket, in the event of an accidental disconnection and a quick reconnection. Messages that the server intends to deliver to the client are cached temporarily until reconnection.
	
	The implementation of reconnection logic (potentially with retries) is left for the user. By default, transports that are keep-alive or open all the time (like WebSocket) have a timeout of 0 if a disconnection is detected.
	
* Message batching

	Messages are buffered in order to optimize resources. In the event of the server trying to send multiple messages while a client is temporarily disconnected (eg: xhr polling), the messages are stacked and then encoded in a lightweight way, and sent to the client whenever it becomes available.

Despite this extra layer, the messages are delivered unaltered to the various event listeners. You can `JSON.stringify()` objects, send XML, or even plain text.

## Credits

- Guillermo Rauch &lt;guillermo@learnboost.com&gt; ([Guille](http://github.com/guille))

- Arnout Kazemier ([3rd-Eden](http://github.com/3rd-Eden))

## License 

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
