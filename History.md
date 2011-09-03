
0.8.3 / 2011-09-03
==================

  * Fixed `\n` parsing for non-JSON packets.
  * Fixed; make Socket.IO XHTML doctype compatible (fixes #460 from server)
  * Fixed support for Node.JS running `socket.io-client`.
  * Updated repository name in `package.json`.
  * Added support for different policy file ports without having to port
    forward 843 on the server side [3rd-Eden]

0.8.2 / 2011-08-29
==================

  * Fixed flashsocket detection.

0.8.1 / 2011-08-29
==================

  * Bump version.

0.8.0 / 2011-08-28
==================

  * Added MozWebSocket support (hybi-10 doesn't require API changes) [einaros].

0.7.11 / 2011-08-27
===================

  * Corrected previous release (missing build).

0.7.10 / 2011-08-27
===================

  * Fix for failing fallback in websockets

0.7.9 / 2011-08-12
==================

  * Added check on `Socket#onConnect` to prevent double `connect` events on the main manager.
  * Fixed socket namespace connect test. Remove broken alternative namespace connect test.
  * Removed test handler for removed test.
  * Bumped version to match `socket.io` server.

0.7.5 / 2011-08-08
==================

  * Added querystring support for `connect` [3rd-Eden]
  * Added partial Node.JS transports support [3rd-Eden, josephg]
  * Fixed builder test.
  * Changed `util.inherit` to replicate Object.create / __proto__.
  * Changed and cleaned up some acceptance tests.
  * Fixed race condition with a test that could not be run multiple times.
  * Added test for encoding a payload.
  * Added the ability to override the transport to use in acceptance test [3rd-Eden]
  * Fixed multiple connect packets [DanielBaulig]
  * Fixed jsonp-polling over-buffering [3rd-Eden]
  * Fixed ascii preservation in minified socket.io client [3rd-Eden]
  * Fixed socket.io in situations where the page is not served through utf8.
  * Fixed namespaces not reconnecting after disconnect [3rd-Eden]
  * Fixed default port for secure connections.

0.7.4 / 2011-07-12
==================

  * Added `SocketNamespace#of` shortcut. [3rd-Eden]
  * Fixed a IE payload decoding bug. [3rd-Eden]
  * Honor document protocol, unless overriden. [dvv]
  * Fixed new builder dependencies. [3rd-Eden]

0.7.3 / 2011-06-30 
==================

  * Fixed; acks don't depend on arity. They're automatic for `.send` and
    callback based for `.emit`. [dvv]
  * Added support for sub-sockets authorization. [3rd-Eden]
  * Added BC support for `new io.connect`. [fat]
  * Fixed double `connect` events. [3rd-Eden]
  * Fixed reconnection with jsonp-polling maintaining old sessionid. [franck34]

0.7.2 / 2011-06-22
==================

  * Added `noop` message type.

0.7.1 / 2011-06-21
==================

  * Bumped socket.io dependency version for acceptance tests.

0.7.0 / 2011-06-21
==================

  * http://socket.io/announcement.html

