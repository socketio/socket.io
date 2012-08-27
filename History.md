
0.2.2 / 2012-08-26
==================

  * server: remove buffering for flash policy requests
  * transport: avoid unhandled error events for stale transports (fixes #69)
  * readme: documented `toString` behavior on `send` [EugenDueck]

0.2.1 / 2012-08-13
==================

  * polling-xhr: skip Keep-Alive when it's implied [EugenDueck]
  * polling-jsonp: skip Keep-Alive when it's implied [EugenDueck]
  * README: added plugins list with engine.io-conflation
  * socket: added flush/drain events (fixes #56)
  * server: avoid passing websocket to non-websocket transports (fixes #24)

0.2.0 / 2012-08-06
==================

  * Bumped client
  * test: added closing connection test
  * server: implemented stronger id generator with collision detection

0.1.2 / 2012-08-02
==================

  * Fixed a jsonp bug in Nokia mobile phones and potentially other UAs.

0.1.1 / 2012-08-01
==================

  * Fixed errors when a socket is closed while upgrade probe is happening.
  * Improved WS error handling
  * Replaced websocket.io with ws, now that it supports older drafts
  * README fixes

0.1.0 / 2012-07-03
==================

  * Initial release.
