
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
