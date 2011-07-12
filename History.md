
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

