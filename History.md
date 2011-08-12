
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

