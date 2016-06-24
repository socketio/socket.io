
1.6.11 / 2016-06-23
===================

  * package: bump `ws` to support `maxPayload`

1.6.10 / 2016-06-23
===================

  * set a default ws `maxPayload` [security fix]
  * bump `accepts` [security fix]

1.6.9 / 2016-05-03
==================

  * bump client

1.6.8 / 2016-01-25
==================

  * fix graceful close [nkzawa]
  * polling: don't set the `closeTimeoutTimer` if the transport is upgraded

1.6.7 / 2016-01-10
==================

  * bump version

1.6.6 / 2016-01-07
==================

  * bump version

1.6.5 / 2016-01-05
==================

  * package: upgrade ws for sec advisory
  * server: catch websocket errors before upgrade

1.6.4 / 2015-12-04
==================

  * package: bump parser for arraybuffer base64 fix

1.6.3 / 2015-12-01
==================

  * restore testing on 0.8
  * improve X-XSS-Protection header definition [nkzawa]
  * add threshold for permessage-deflate [nkzawa]

1.6.2 / 2015-11-30
==================

  * don't compress control packets

1.6.1 / 2015-11-28
==================

  * package: bump `engine.io-client` for `ws` options fix
  * fix `latency` example

1.6.0 / 2015-11-28
==================

  * add support for environments that extend `Object.prototype`
  * remove listeners upon `clearTransport`
  * support for all versions of node
  * fix lingering sockets that can stay open when upgrade failed
  * ensure sockets are closed on error
  * bump `ws` for several improvements
  * fix for a rare race condition on some error scenarios
  * support custom socket id
  * use container-based infrastructure for faster build
  * fix package.json wrongly referrering to self
  * allow overriding the `cookiePath`
  * fix potential encoding errors under certain conditions
  * support compression

1.5.4 / 2015-09-09
==================

  * package: bump `engine.io-parser`

1.5.3 / 2015-09-09
==================

  * package: bump `ws` to fix node 4.0.0

1.5.2 / 2015-07-09
==================

  * package: bump `ws` to fix build issues

1.5.1 / 2015-01-19
==================

 * no change on this release
 * package: bump `engine.io-client`

1.5.0 / 2015-01-18
==================

 * package: bump `engine.io-parser`
 * polling: correctly abort the ongoing data request when closing [lpinca]
 * add cert-related client tests [rase-]

1.4.3 / 2014-11-21
==================

 * package: bump `ws` to fix fd leaks
 * socket: flush the write buffer before closing the socket [lpinca]
 * polling: close the pending poll request when closing transport [lpinca]

1.4.2 / 2014-10-08
==================

 * add iframe onload handling to jsonp tests [rase-]

1.4.1 / 2014-10-03
==================

 * socket: allow upgrades if the socket is still in closing state
 * README: fix typo

1.4.0 / 2014-09-03
==================

 * readme: fix formatting for goals numbering
 * server: ref fix by @nicokaiser
 * server: fix ws memory leak (fixes #268)
 * cache remote address in handshake since it might be lost later.
 * correct git ref
 * update client to commit with bumped parser
 * package: bump parser
 * npmignore: ignore `.gitignore`
 * package: bump `debug`
 * package: bump `engine.io-parser` for memleak fix

1.3.1 / 2014-06-19
==================

 * package: bump `engine.io-client`

1.3.0 / 2014-06-13
==================

 * update example to use v1.2.2
 * fixed newline parsing in jsonp
 * make require('engine.io')() return a new Server instance [defunctzombie]
 * add Server.attach method [defunctzombie]
 * fix GH-211, set CORS headers when sending error message [mokesmokes]

1.2.2 / 2014-05-30
==================

 * package: bump `engine.io-parser` for binary utf8 fix

1.2.1 / 2014-05-22
==================

 * package: bump engine.io-client

1.2.0 / 2014-05-18
==================

 * removed flashsocket, moving to userland

1.1.1 / 2014-05-14
==================

 * test: reduce packet size
 * package: bump parser

1.1.0 / 2014-04-27
==================

 * socket: removed unneeded `clearTimeout` (fixes #250)
 * made the request verification process async
 * package: bump `engine.io-parser`
 * use _query instead of query, fixes compat with restify
 * added a maximum buffer size to received data from polling
 * fixing looping array via for in to normal loop

1.0.5 / 2014-03-18
==================

 * package: bump `engine.io-parser` and `engine.io-client`

1.0.4 / 2014-03-14
==================

 * package: bump `engine.io-client`

1.0.3 / 2014-03-12
==================

 * package: bump `engine.io-client`

1.0.2 / 2014-03-12
==================

 * bump engine.io-client

1.0.1 / 2014-03-06
==================

 * package: bump `engine.io-parser`
 * transports: fix jshint warnings and style

1.0.0 / 2014-03-06
==================

 * polling-xhr: added `OPTIONS` support, fixes CORS
 * close() properly when triggered in connection handler
 * fix DDOS vector by setting up too many intervals
 * binary support

0.9.0 / 2014-02-09
==================

 * Prevent errors with connections behind proxies without WS support
   like Squid [nicklagrow, samaanghani, davidhcummings]
 * Socket#request a simple property [mokesmokes]
 * Changed `Socket`'s `upgrade` event to happen after upgrade [mokesmokes]
 * Document `Socket#id` [mokesmokes]

0.8.2 / 2014-01-18
==================

 * package: bump `engine.io-client`

0.8.1 / 2014-01-17
==================

 * package: bump `engine.io-client`
 * package: pin dev deps
 * examples: fix port output
 * fix latency example

0.8.0 / 2014-01-05
==================

 * package: bump `engine.io-client` to `0.8.0`
 * test: fix syntax, remove globals

0.7.14 / 2014-01-01
===================

 * package: bump `engine.io-client` to `0.7.14`

0.7.13 / 2013-12-20
===================

 * package: bump `engine.io-client`
 * transports: added support for XSS filters on IE [guille, 3rd-eden]

0.7.12 / 2013-11-11
===================

 * package: bump `engine.io-client`

0.7.11 / 2013-11-06
===================

 * package: bump engine.io-client
 * fix GH-198

0.7.10 / 2013-10-28
===================

 * package: bump `engine.io-client`
 * package: update "ws" to v0.4.31

0.7.9 / 2013-08-30
==================

 * package: bump `engine.io-client`

0.7.8 / 2013-08-30
==================

 * package: bump `engine.io-client`
 * package: bump ws

0.7.7 / 2013-08-30
==================

 * package: bump `engine.io-client`

0.7.6 / 2013-08-30
==================

 * package: bump engine.io-client

0.7.5 / 2013-08-30
==================

 * package: bump engine.io-client

0.7.4 / 2013-08-25
==================

 * package: bump `engine.io-client`

0.7.3 / 2013-08-23
==================

 * package: bump engine.io-client (noop)
 * package: fix regresison in upgrade cause by ws update

0.7.2 / 2013-08-23
==================

 * package: bump `engine.io-client` for `WebSocket` browser fix

0.7.1 / 2013-08-23
==================

 * package: bump engine.io-client for ws fix

0.7.0 / 2013-08-23
==================

 * package: bump engine.io-client
 * updated example
 * inline merge
 * added support node version 0.10 to .travis.yml
 * fixed respond to flash policy request test. Closes #184
 * fixed upgrade with timeout test. Closes #185
 * engine.io: don't use __proto__, closes #170

0.6.3 / 2013-06-21
==================

  * package: bumped `engine.io-client` to `0.6.3`

0.6.2 / 2013-06-15
==================

  * fix upgrade stalling edge case introduced with #174 fix
  * remove unneeded client code related to iOS
  * added test for `engine.io-client` `0.6.1`

0.6.1 / 2013-06-06
==================

  * package: bumped `engine.io-client` to `0.6.1`

0.6.0 / 2013-05-31
==================

  * socket: clear timer after sending one noop packet (fixes #174)
  * clear all timers on socket close
  * sending error on transport creation upon a bad request
  * added test for client-side buffer cleanup
  * changed flushComplete to flush
  * ended support for node 0.6

0.5.0 / 2013-03-16
==================

  * polling: implemented new parser
  * test writeBuffer isn't cleared onError, removed 'closing' check in .flush()
  * fixed bug89 and added tests: writeBuffer not flushed until nextTick

0.4.3 / 2013-02-08
==================

  * package: bumped `engine.io-client` to `0.4.3`

0.4.2 / 2013-02-08
==================

  * Only end upgrade socket connections if unhandled
  * Fix websocket dependency
  * Close socket if upgrade is received and socket.readyState != open

0.4.1 / 2013-01-18
==================

  * package: bumped versions
  * Fixed bugs in previous send callback fix and updated test cases
  * Added a test case which makes the code before the send callback fix fail
  * socket: emit `data` event (synonym with `message`)
  * socket: added `Socket#write`
  * engine.io: cleanup
  * engine.io: deprecated `resource`
  * `npm docs engine.io` works now

0.3.10 / 2012-12-03
===================

  * package: bumped `engine.io-client` with `close` fixes
  * add packetCreate event [jxck]
  * add packet event to socket [jxck]
  * transport: remove `Connection` headers and let node handle it
  * server: send validation failure reason to clients
  * engine: invoking as a function causes attach
  * socket: reset `writeBuffer` before send

0.3.9 / 2012-10-23
==================

  * package: bumped `engine.io-client`

0.3.8 / 2012-10-23
==================

  * package: bumped engine.io-client
  * examples: added first example

0.3.7 / 2012-10-21
==================

  * package: bumped `engine.io-client`

0.3.6 / 2012-10-21
==================

  [skipped]

0.3.5 / 2012-10-14
==================

  * package: reverted last commit - we use the parser from the client

0.3.4 / 2012-10-14
==================

  * package: `engine.io-client` moved to `devDependencies`
  * socket: added missing jsdoc

0.3.3 / 2012-10-10
==================

  * socket: fixed check interval clearing [joewalnes]
  * transports: improved instrumentation

0.3.2 / 2012-10-08
==================

  * socket: improve check interval for upgrade

0.3.1 / 2012-10-08
==================

  * socket: faster upgrades (we perform a check immediately)
  * server: don't assume sid is numeric

0.3.0 / 2012-10-04
==================

  * socket: `writeBuffer` now gets sliced, and is recoverable after `close` [afshinm]
  * server: expect ping from client and send interval with handshake [cadorn]
  * polling-jsonp: prevent client breakage with utf8 whitespace
  * socket: fix `flush` and `drain` events
  * socket: add `send` callback [afshinm]
  * transport: avoid unhandled error events for stale transports
  * README: documentation improvements [EugenDueck]

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
