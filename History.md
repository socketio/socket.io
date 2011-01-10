
0.6.8 / 2011-01-10 
==================

  * Fixed issue with terminating connection twice

0.6.7 / 2011-01-09 
==================

  * Fixed situation where the connection drops but the client can still autoreconnect
    through a different socket. In this case we still want to clear the FD but not
    call onDisconnect immediately.

0.6.6 / 2011-01-09 
==================

  * Note for Flash socket and inline policy on Firefox
  * Destroy the fds on disconnect
  * Restored 20 secs of polling so that node doesn't timeout the connections

0.6.5 / 2011-01-09 
==================

  * Make sure not to trigger multiple timeouts when closing
  * Important fix for polling transports.

0.6.4 / 2011-01-05 
==================

  * Don't destroy the connection in _onClose. Destroying it will prevent the buffers from being flushed and will result in corrupted responses for the xhr-polling transport.
  * Added try/catch block around JSON.parse and return an empty object literal if JSON parsing fails.
  * Added missing .connect() to example

0.6.3 / 2010-12-23 
==================

  * Changed polling default duration to 50 seconds
  * might > will Adjusted to 85 column limit
  * Support for resources that include slashes. Thanks @schamane
  * Lazy loading of transports. Thanks @technoweenie Fixed README transports list
  * OpenSSL clarifications (thanks @bmnds)
  * Support for HAProxy load balancing (thanks Brian McKelvey) Backported Parser from 0.7
  * Fixed HTTP API in example (was outdated). Thanks deedubs
  * 0.3 compatibility (thanks Arnout)
  * `client.broadcast` now 300% faster Cleaned up chat example 
  * fixed bad pluralization.
  * cleaned up grammar, missing punctuation, etc.
  * Restored global `netserver` for flashsocket Now supporting `flashPolicyServer` option (thanks Arnout) Tests passing with and without sudo/root user Fixed noDelay/timeout/utf-8 for draft 76 (accidental typo)
  * Close the netServer when the main http server closes, this way the event loop does not keep running. NOTE: this is patch for node 0.2.X, this is not required for node 0.3.X
  * Fallback to try{}catch handling for node < 0.2.4 , node 0.3.X seems to capture the errors correctly using the error event.
  * Added the flash policy server, it's enabled by default but can be turned off if needed. Socket.io will automatically fallback to serving the policy file inline if server is disabled or unable to start up.
  * Make sure to only write to open transports (thanks JohnDav)
  * _open is still false, so destroy the connection immediately upon websocket error
  * Make sure .connection is not null on 'end'
  * Proper fix for invalid websocket key

0.6.1 / 2010-11-08

  * Restored flash policy server, but with these changes:
    - It's contingent on the listener flashPolicyServer option 
    - It's started by default if socket.io is started with root access
    - It correctly closes the netserver upon all the dependent http servers being closed
    - The handler for the inline request is still there regardless. This is important in the following circumstances, and has no performance hit
      - The port 843 is filtered
      - Flash at some point enables us to skip 843 checking altogether
      - Tests compatibility
  * Fixed connection timeout, noDelay and socket encoding for draft 76 (had been  accidentally moved into the `else` block)
  * Some stylistic fixes

0.6.0 / 2010-11-01 
==================

  * Make sure to only write to open transports (thanks JohnDav)
  * _open is still false, so destroy the connection immediately upon websocket error
  * Make sure to disconnect directly onClose if the client is not handshaked and he can't possibly reconnect
  * Make sure to end and destroy connection onDisconnect (for timeouts)
  * Added missing .listen() call to example. Fixes #80. Thanks @machee
  * Invalid transport test completed
  * Initial stab at trying to detect invalid transport responses
  * Make sure to provide a default for `log` if no log key was provided (internal)
  * Removed unnecessary file extension verification when serving the client
  * Removed unnecessary Client check upon connection
  * Added support for /socket.io/WebSocketMain.swf
  * Added test for /socket.io/WebSocketMain.swf
  * Client serving ETag testing
  * Added htmlfile transport tests
  * Added extra byte to IE iframe bytes padding
  * Invalid session id test
  * end() before destroy()ing the socket for non-WebSocket or non-valid Upgrade requests
  * Added test for non-socket.io requests
  * Simplified index.js tests
  * Moved listener tests into listener.js
  * Make sure to call .end() when listening on connection 'end' event
  * Make sure the file descriptor is destroyed on disconnection
  * Fix for websocket client tracking test
  * Inline (same port) flash socket policy request.
  * If the server is not run with root privileges, then the flashsocket
  transport will instead listen to all new connections on the main port
  for policy requests. Flash policy requests happen to both port 843 and
  the destination port:
  http://www.lightsphere.com/dev/articles/flash_socket_policy.html

  * [websocket test] Fix sending message to client upon connecting
  * [websocket test] Fix for connection and handshake test
  * [client files serving] Leverage end() write() call
  * [client serving] Make sure to not do a useless file lookup when file is cached
  * Finished json encoding test
  * Look for the heartbeat in the decoded message
  * Refactored websocket transports tests to match polling/multipart helpers
  * Added coverage testing to Makefile
  * Added heartbeat test to multipart
  * Added buffered messages test for multipart
  * Added assertions for `connected` property for all the tests
  * Multipart clients tracking test
  * Multipart client>server message sending test
  * Make sure to only close the client stream when the roundtrip is complete
  * Multipart connection and handshake tests:
    - Implemented HTTP client on top of net.Stream with multipart boundary parsing for testing
    - Test for connection / server>client message sending
  * Removed unnecessary check for this.connection (since we now access the socket through req.connection for all transports)
  * Test for `duration` parameter
  * Added `make example` to Makefile
  * Added clients tracking test for long polling
  * Added message buffering test for long polling
  * Improve this.request/this.response/this.connection
  * Add 'end' listener onConnect, applies to all transports
  * Improved error handling onConnect
  * Remove legacy `flush` calls
  * Removed unnecessary closeTimeout clearing in jsonp polling
  * Make sure to close on disconnect if _open = true
  * Clear disconnection timeout on disconnection (double check)
  * Make sure to clear closeTimeout for polling transports on close.
  * Replaced empty with null in log option
  * Comma first style for client serving tests
  * Long polling integration tests
  * Test for heartbeat message
  * Added heartbeat timeout test
  * Support for listener#log false
  * Corrected onConnect signature to support a request and a socket, or a request and a response.
  * Removed error checking for non-upgradeable sockets, since they'll be destroyed, and error handling is done onConnect
  * Added tests for websocket client tracking
  * Added tests for websocket message buffering
  * Make sure disconnect timeout is cleared on websocket re-connect
  * Updated the flash socket with error detection, and readystate detection.
  * This is needed because when a error occures we close down the connection,
  * and the stream will become unwriteable.
  * Also changed to a single write instead of multiple writes.
  * Moved error handling to onConnect to avoid messing with the http.Server global error handlers
  * Do special error handling for websocket
  * Clearing heartbeat interval upon closing the connection
  * Added error listeners, if theses errors are not correcly caught, they will leak memory.
  * This caused http://speedo.no.de/ to go up from 1mb per connection after a ECONNECTRESET message
  * Added encode=UTF-8 in jsonp-polling.js and xhr-polling.js since UTF-8 is the default encoding for http.ServerResponse.write
  * Replaced string.length with Buffer.byteLength in jsonp-polling.js, listener.js and xhr-polling.js because content-length header requires number of bytes and not the number of symbols in string
  * Fix COR headers/requests for different ports on Safari.
  * Clearing the references to request, response and connection upon disconnect.
  * Every require is blocking and requiring the sys module over and over and over again just makes no sense + it hurt performance.. Not to mention.. that it's already included.
  * Socket.IO-node now serves the client out of the box for easier implementation
  * Memory caching and ETag support for static files
  * Tests
  * Simplified demo even further thanks to new static file serving
  * Failing to pass an origin header would throw an exception and crash the server. Added some handling.
  * .connected renamed to ._open, and adopted proper `connected` (fixes #41)
  * example/client updated to latest socket.io client
  * Better checking of WebSocket connections
  * Better handling of SSL location (thanks @jdub)
  * Fix for cross-domain websocket (fixes #42)
  * Removed clients/clientsIndex and only using the index (fixes #28)
  * Fixed WebSocket location header for ws/wss (Thanks @jdub, Fixes #40)
  * Cross domain issues with xhr-polling addressed. Thanks Niko Kaiser (@nicokaiser)
  * Added origin verification for incoming data.
  * Make sure pathname is set (thanks steadicat & swarmation team)
  * Fix for accessing routes that being with the namespace but are not a connection attempt. Thanks @steadicat from swarmation
  * JSONP-polling support
  * Graceful closing of connection for invalid websocket clients
  * Make it possible to just require 'socket.io'
  * Make sure to abort the connect() method upon bad upgrade / origin verification
  * Support for automatic JSON encoding/decoding
  * Simplified chat example to take advantage of JSON encoding/decoding
  * Removed fs sync call from example
  * Better `how to use`
  * Make sure to send content-type text/plain to `ok` POST responses

