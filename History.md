
0.8.5 / 2011-10-07
==================

  * Added websocket draft HyBi-16 support. [einaros]
  * Fixed websocket continuation bugs. [einaros]
  * Fixed flashsocket transport name.
  * Fixed websocket tests.
  * Ensured `parser#decodePayload` doesn't choke.
  * Added http referrer verification to manager verifyOrigin.
  * Added access control for cross domain xhr handshakes [3rd-Eden]
  * Added support for automatic generation of socket.io files [3rd-Eden]
  * Added websocket binary support [einaros]
  * Added gzip support for socket.io.js [3rd-Eden]
  * Expose socket.transport [3rd-Eden]
  * Updated client.

0.8.4 / 2011-09-06
==================

  * Client build

0.8.3 / 2011-09-03
==================

  * Fixed `\n` parsing for non-JSON packets (fixes #479).
  * Fixed parsing of certain unicode characters (fixes #451).
  * Fixed transport message packet logging.
  * Fixed emission of `error` event resulting in an uncaught exception if unhandled (fixes #476).
  * Fixed; allow for falsy values as the configuration value of `log level` (fixes #491).
  * Fixed repository URI in `package.json`. Fixes #504.
  * Added text/plain content-type to handshake responses [einaros]
  * Improved single byte writes [einaros]
  * Updated socket.io-flashsocket default port from 843 to 10843 [3rd-Eden]
  * Updated client.

0.8.2 / 2011-08-29
==================

  * Updated client.

0.8.1 / 2011-08-29
==================

  * Fixed utf8 bug in send framing in websocket [einaros]
  * Fixed typo in docs [Znarkus]
  * Fixed bug in send framing for over 64kB of data in websocket [einaros]
  * Corrected ping handling in websocket transport [einaros]

0.8.0 / 2011-08-28
==================

  * Updated to work with two-level websocket versioning. [einaros]
  * Added hybi07 support. [einaros]
  * Added hybi10 support. [einaros]
  * Added http referrer verification to manager.js verifyOrigin. [einaors]

0.7.11 / 2011-08-27
===================

  * Updated socket.io-client.

0.7.10 / 2011-08-27
===================

  * Updated socket.io-client.

0.7.9 / 2011-08-12
==================

  * Updated socket.io-client.
  * Make sure we only do garbage collection when the server we receive is actually run.

0.7.8 / 2011-08-08
==================

  * Changed; make sure sio#listen passes options to both HTTP server and socket.io manager.
  * Added docs for sio#listen.
  * Added options parameter support for Manager constructor.
  * Added memory leaks tests and test-leaks Makefile task.
  * Removed auto npm-linking from make test.
  * Make sure that you can disable heartbeats. [3rd-Eden]
  * Fixed rooms memory leak [3rd-Eden]
  * Send response once we got all POST data, not immediately [Pita]
  * Fixed onLeave behavior with missing clientsk [3rd-Eden]
  * Prevent duplicate references in rooms.
  * Added alias for `to` to `in` and `in` to `to`.
  * Fixed roomClients definition.
  * Removed dependency on redis for installation without npm [3rd-Eden]
  * Expose path and querystring in handshakeData [3rd-Eden]

0.7.7 / 2011-07-12
==================

  * Fixed double dispatch handling with emit to closed clients.
  * Added test for emitting to closed clients to prevent regression.
  * Fixed race condition in redis test.
  * Changed Transport#end instrumentation.
  * Leveraged $emit instead of emit internally.
  * Made tests faster.
  * Fixed double disconnect events.
  * Fixed disconnect logic
  * Simplified remote events handling in Socket.
  * Increased testcase timeout.
  * Fixed unknown room emitting (GH-291). [3rd-Eden]
  * Fixed `address` in handshakeData. [3rd-Eden]
  * Removed transports definition in chat example.
  * Fixed room cleanup
  * Fixed; make sure the client is cleaned up after booting.
  * Make sure to mark the client as non-open if the connection is closed.
  * Removed unneeded `buffer` declarations.
  * Fixed; make sure to clear socket handlers and subscriptions upon transport close.

0.7.6 / 2011-06-30
==================

  * Fixed general dispatching when a client has closed.

0.7.5 / 2011-06-30
==================

  * Fixed dispatching to clients that are disconnected.

0.7.4 / 2011-06-30
==================

  * Fixed; only clear handlers if they were set. [level09]

0.7.3 / 2011-06-30
==================

  * Exposed handshake data to clients.
  * Refactored dispatcher interface.
  * Changed; Moved id generation method into the manager.
  * Added sub-namespace authorization. [3rd-Eden]
  * Changed; normalized SocketNamespace local eventing [dvv]
  * Changed; Use packet.reason or default to 'packet' [3rd-Eden]
  * Changed console.error to console.log.
  * Fixed; bind both servers at the same time do that the test never times out.
  * Added 304 support.
  * Removed `Transport#name` for abstract interface.
  * Changed; lazily require http and https module only when needed. [3rd-Eden]

0.7.2 / 2011-06-22
==================

  * Make sure to write a packet (of type `noop`) when closing a poll.
    This solves a problem with cross-domain requests being flagged as aborted and
    reconnection being triggered.
  * Added `noop` message type.

0.7.1 / 2011-06-21 
==================

  * Fixed cross-domain XHR.
  * Added CORS test to xhr-polling suite.

0.7.0 / 2010-06-21
==================

  * http://socket.io/announcement.html
