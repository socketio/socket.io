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

- Node v0.1.103+
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
		res.writeHeader(200, {'Content-Type': 'text/html'});
		res.writeBody('<h1>Hello world</h1>');
		res.finish();
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

		['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']
		
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

In order to make polling transports simulate the behavior of a full-duplex WebSocket, a session protocol and a message framing mechanism are required.

The session protocol consists of the generation of a session id that is passed to the client when the communication starts. Subsequent connections to the server within that session send that session id in the URI along with the transport type.

### Message encoding

    (message type)":"(content length)":"(data)","

(message type) is a single digit that represents one of the known message types (described below).

(content length) is the number of characters of (data)

(data) is the message

    0 = force disconnection
      No data or annotations are sent with this message (it's thus always sent as "0:0:,")
      
    1 = message
      Data format:
      (annotations)":"(message)

      Annotations are meta-information associated with a message to make the Socket.IO protocol extensible. They're conceptually similar to HTTP headers. They take this format:
  
        [key[:value][\n key[:value][\n ...]]]

      For example, when you `.send('Hello world')` within the realm `'chat'`, Socket.IO really is sending:

        1:18:r:chat:Hello world,
  
      Two annotations are used by the Socket.IO client: `r` (for `realm`) and `j` (for automatic `json` encoding / decoding of the message).
    
    2 = heartbeat
      Data format:
      (heartbeat numeric index)
      
      Example:
        2:1:0,
        2:1:1,

    3 = session id handshake
      Data format:
      (session id)

      Example:
        3:3:253,

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
