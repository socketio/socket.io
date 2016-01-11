
1.4.4 / 2016-01-10
==================

  * package: bump `engine.io`

1.4.3 / 2016-01-08
==================

  * bump `socket.io-client`

1.4.2 / 2016-01-07
==================

  * bump `engine.io`

1.4.1 / 2016-01-07
==================

  * version bump

1.4.0 / 2015-11-28
==================

  * socket.io: increase large binary data test timeout
  * package: bump `engine.io` for release
  * trigger callback even when joining an already joined room
  * package: bump parser
  * namespace: clear rooms flag after a clients call (fixes #1978)
  * package: bump `socket.io-parser`
  * fixed tests with large data
  * fixed a typo in the example code
  * package: bump mocha
  * package: bump `has-binary` and `zuul-ngrok`
  * package: bump `engine.io` and `socket.io-client`
  * README: clarified documentation of Socket.in
  * README: fixed up legacy repo links
  * test: better timeout for stress test
  * socket: don't set request property which has a getter
  * removed proxy index file
  * support flags on namespace
  * improve Socket#packet and Client#packet
  * socket: warn node_redis-style about missing `error`
  * test: added failing test
  * test: increase timeout for large binary data test
  * package: bump `has-binary` to work with all objects (fixes #1955)
  * fix origin verification default https port [evanlucas]
  * support compression [nkzawa]

1.3.7 / 2015-09-21
==================

  * package: bump `socket.io-client` for node4 compatibility
  * package: bump `engine.io` for node4 compatibility

1.3.6 / 2015-07-14
==================

  * package: bump `engine.io` to fix build on windows

1.3.5 / 2015-03-03
==================

 * package: bump `socket.io-parser`

1.3.4 / 2015-02-14
==================

 * package: bump `socket.io-client`

1.3.3 / 2015-02-03
==================

 * socket: warn node_redis-style about missing `error`
 * package: bump parser to better handle bad binary packets

1.3.2 / 2015-01-19
==================

 * no change on this release

1.3.1 / 2015-01-19
==================

 * no change on this release
 * package: bump `engine.io`

1.3.0 / 2015-01-19
==================

 * package: bump `engine.io`
 * add test for reconnection after server restarts [rase-]
 * update license with up-to-date year range [fay-jai]
 * fix leaving unknown rooms [defunctzombie]
 * allow null origins when allowed origins is a function [drewblaisdell]
 * fix tests on node 0.11
 * package: fix `npm test` to run on windows
 * package: bump `debug` v2.1.0 [coderaiser]
 * added tests for volatile [rase-]

1.2.1 / 2014-11-21
==================

 * fix protocol violations and improve error handling (GH-1880)
 * package: bump `engine.io` for websocket leak fix [3rd-Eden]
 * style tweaks

1.2.0 / 2014-10-27
==================

 * package: bump `engine.io`
 * downloads badge
 * add test to check that empty rooms are autopruned
 * added Server#origins(v:Function) description for dynamic CORS
 * added test coverage for Server#origins(function) for dynamic CORS
 * added optional Server#origins(function) for dynamic CORS
 * fix usage example for Server#close
 * package: fix main file for example application 'chat'
 * package: bump `socket.io-parser`
 * update README http ctor to createServer()
 * bump adapter with a lot of fixes for room bookkeeping

1.1.0 / 2014-09-04
==================

 * examples: minor fix of escaping
 * testing for equivalence of namespaces starting with / or without
 * update index.js
 * added relevant tests
 * take "" and "/" as equivalent namespaces on server
 * use svg instead of png to get better image quality in readme
 * make CI build faster
 * fix splice arguments and `socket.rooms` value update in `socket.leaveAll`.
 * client cannot connect to non-existing namespaces
 * bump engine.io version to get the cached IP address
 * fixed handshake object address property and made the test case more strict.
 * package: bump `engine.io`
 * fixed the failing test where server crashes on disconnect involving connectBuffer
 * npmignore: ignore `.gitignore` (fixes #1607)
 * test: added failing case for `socket.disconnect` and nsps
 * fix repo in package.json
 * improve Close documentation
 * use ephemeral ports
 * fix: We should use the standard http protocol to handler the etag header.
 * override default browser font-family for inputs
 * update has-binary-data to 1.0.3
 * add close specs
 * add ability to stop the http server even if not created inside socket.io
 * make sure server gets close
 * Add test case for checking that reconnect_failed is fired only once upon failure
 * package: bump `socket.io-parser` for `component-emitter` dep fix

1.0.6 / 2014-06-19
==================

 * package: bump `socket.io-client`

1.0.5 / 2014-06-16
==================

 * package: bump `engine.io` to fix jsonp `\n` bug and CORS warnings
 * index: fix typo [yanatan16]
 * add `removeListener` to blacklisted events
 * examples: clearer instructions to install chat example
 * index: fix namespace `connectBuffer` issue

1.0.4 / 2014-06-02
==================

 * package: bump socket.io-client

1.0.3 / 2014-05-31
==================

 * package: bump `socket.io-client`
 * package: bump `socket.io-parser` for binary ACK fix
 * package: bump `engine.io` for binary UTF8 fix
 * example: fix XSS in chat example

1.0.2 / 2014-05-28
==================

 * package: bump `socket.io-parser` for windows fix

1.0.1 / 2014-05-28
==================

 * bump due to bad npm tag

1.0.0 / 2014-05-28
==================

 * stable release

1.0.0-pre5 / 2014-05-22
=======================

 * package: bump `socket.io-client` for parser fixes
 * package: bump `engine.io`

1.0.0-pre4 / 2014-05-19
=======================

 * package: bump client

1.0.0-pre3 / 2014-05-17
=======================

 * package: bump parser
 * package: bump engine.io

1.0.0-pre2 / 2014-04-27
=======================

 * package: bump `engine.io`
 * added backwards compatible of engine.io maxHttpBufferSize
 * added test that server and client using same protocol
 * added support for setting allowed origins
 * added information about logging
 * the set function in server can be used to set some attributes for BC
 * fix error in callback call 'done' instead of 'next' in docs
 * package: bump `socket.io-parser`
 * package: bump `expect.js`
 * added some new tests, including binary with acks

1.0.0-pre / 2014-03-14
======================

 * implemented `engine.io`
 * implemented `socket.io-adapter`
 * implemented `socket.io-protocol`
 * implemented `debug` and improved instrumentation
 * added binary support
 * added new `require('io')(srv)` signature
 * simplified `socket.io-client` serving

0.9.14 / 2013-03-29
===================

  * manager: fix memory leak with SSL [jpallen]

0.9.13 / 2012-12-13
===================

  * package: fixed `base64id` requirement

0.9.12 / 2012-12-13
===================

  * manager: fix for latest node which is returning a clone with `listeners` [viirya]

0.9.11 / 2012-11-02
===================

  * package: move redis to optionalDependenices [3rd-Eden]
  * bumped client

0.9.10 / 2012-08-10
===================

  * Don't lowercase log messages
  * Always set the HTTP response in case an error should be returned to the client
  * Create or destroy the flash policy server on configuration change
  * Honour configuration to disable flash policy server
  * Add express 3.0 instructions on Readme.md
  * Bump client

0.9.9 / 2012-08-01
==================

  * Fixed sync disconnect xhrs handling
  * Put license text in its own file (#965)
  * Add warning to .listen() to ease the migration to Express 3.x
  * Restored compatibility with node 0.4.x

0.9.8 / 2012-07-24
==================

  * Bumped client.

0.9.7 / 2012-07-24
==================

  * Prevent crash when socket leaves a room twice.
  * Corrects unsafe usage of for..in
  * Fix for node 0.8 with `gzip compression` [vadimi]
  * Update redis to support Node 0.8.x
  * Made ID generation securely random
  * Fix Redis Store race condition in manager onOpen unsubscribe callback
  * Fix for EventEmitters always reusing the same Array instance for listeners

0.9.6 / 2012-04-17
==================

  * Fixed XSS in jsonp-polling.

0.9.5 / 2012-04-05
==================

  * Added test for polling and socket close.
  * Ensure close upon request close.
  * Fix disconnection reason being lost for polling transports.
  * Ensure that polling transports work with Connection: close.
  * Log disconnection reason.

0.9.4 / 2012-04-01
==================

  * Disconnecting from namespace improvement (#795) [DanielBaulig]
  * Bumped client with polling reconnection loop (#438)

0.9.3 / 2012-03-28
==================

  * Fix "Syntax error" on FF Web Console with XHR Polling [mikito]

0.9.2 / 2012-03-13
==================

  * More sensible close `timeout default` (fixes disconnect issue)

0.9.1-1 / 2012-03-02
====================

  * Bumped client with NPM dependency fix.

0.9.1 / 2012-03-02
==================

  * Changed heartbeat timeout and interval defaults (60 and 25 seconds)
  * Make tests work both on 0.4 and 0.6
  * Updated client (improvements + bug fixes).

0.9.0 / 2012-02-26
==================

  * Make it possible to use a regexp to match the socket.io resource URL.
    We need this because we have to prefix the socket.io URL with a variable ID.
  * Supplemental fix to gavinuhma/authfix, it looks like the same Access-Control-Origin logic is needed in the http and xhr-polling transports
  * Updated express dep for windows compatibility.
  * Combine two substr calls into one in decodePayload to improve performance
  * Minor documentation fix
  * Minor. Conform to style of other files.
  * Switching setting to 'match origin protocol'
  * Revert "Fixes leaking Redis subscriptions for #663. The local flag was not getting passed through onClientDisconnect()."
  * Revert "Handle leaked dispatch:[id] subscription."
  * Merge pull request #667 from dshaw/patch/redis-disconnect
  * Handle leaked dispatch:[id] subscription.
  * Fixes leaking Redis subscriptions for #663. The local flag was not getting passed through onClientDisconnect().
  * Prevent memory leaking on uncompleted requests & add max post size limitation
  * Fix for testcase
  * Set Access-Control-Allow-Credentials true, regardless of cookie
  * Remove assertvarnish from package as it breaks on 0.6
  * Correct irc channel
  * Added proper return after reserved field error
  * Fixes manager.js failure to close connection after transport error has happened
  * Added implicit port 80 for origin checks. fixes #638
  * Fixed bug #432 in 0.8.7
  * Set Access-Control-Allow-Origin header to origin to enable withCredentials
  * Adding configuration variable matchOriginProtocol
  * Fixes location mismatch error in Safari.
  * Use tty to detect if we should add colors or not by default.
  * Updated the package location.

0.8.7 / 2011-11-05
==================

  * Fixed memory leaks in closed clients.
  * Fixed memory leaks in namespaces.
  * Fixed websocket handling for malformed requests from proxies. [einaros]
  * Node 0.6 compatibility. [einaros] [3rd-Eden]
  * Adapted tests and examples.

0.8.6 / 2011-10-27 
==================

  * Added JSON decoding on jsonp-polling transport.
  * Fixed README example.
  * Major speed optimizations [3rd-Eden] [einaros] [visionmedia]
  * Added decode/encode benchmarks [visionmedia]
  * Added support for black-listing client sent events.
  * Fixed logging options, closes #540 [3rd-Eden]
  * Added vary header for gzip [3rd-Eden]
  * Properly cleaned up async websocket / flashsocket tests, after patching node-websocket-client
  * Patched to properly shut down when a finishClose call is made during connection establishment
  * Added support for socket.io version on url and far-future Expires [3rd-Eden] [getify]
  * Began IE10 compatibility [einaros] [tbranyen]
  * Misc WebSocket fixes [einaros]
  * Added UTF8 to respone headers for htmlfile [3rd-Eden]

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
