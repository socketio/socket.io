socket.io Client: Sockets for the rest of us
============================================

The `socket.io` client is basically a simple TCP socket interface implementation. It allows you to establish a realtime connection with a server (see `socket.io` server [here](http://github.com/RosePad/Socket.IO-node)), hiding the complexity of the different transports (WebSocket, long polling, XHR streaming, etc).

How to use
----------

	var Socket = io.Socket,
	socket = new Socket('localhost');
	socket.connect();
	socket.send('some data');
	socket.addEvent('message', function(data){
		alert('got some data' + data);
	});
	
Features
--------

- Supports 
	- WebSocket
	- Adobe Flash Socket
	- ActiveX HTMLFile (IE) 
	- Server-Sent Events (Opera)
	- XHR with multipart encoding
	- XHR with long-polling
	
- On a successful connection, it remembers the transport for next time (stores it in a cookie)

Documentation 
-------------

	new io.Socket(host, [options]);

Options:

- *port*

		80
	
	The port `socket.io` server is attached to

- *resource*

		socket.io

  The resource is what allows the `socket.io` server to identify incoming connections by `socket.io` clients. In other words, any HTTP server can implement socket.io and still serve other normal, non-realtime HTTP requests.

- *transports*

		['websocket', 'server-events', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling']

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
	
- *addEvent(event, λ)*

	Adds a listener for the event *event*
	
- *removeEvent(event, λ)*

	Removes the listener λ for the event *event*
	
Events:

- *connect*

	Fired when the connection is established and the handshake successful
	
- *message(message)*
	
	Fired 

- *close*

	Fired when the connection is closed. Be careful with using this event, as some transports will fire it even under temporary, expected disconnections (such as XHR-Polling).
	
- *disconnect*

	Fired when the connection is considered disconnected.

	
Credits
-------

Guillermo Rauch <guillermo@rosepad.com>