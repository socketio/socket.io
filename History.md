
0.5.0 / 2013-03-16
==================

  * socket: implement qs support for `string`
  * added query.EIO to take protocol version from parser
  * use istanbul for code coverage
  * integrated engine.io-protocol 0.3.0
  * updated ws
  * fixed JSONPPolling iframe removal error
  * changed error message to match xhr error message on jsonp transport script tag
  * Added onerror handler for script tag in jsonp transport
  * remove uid qs
  * Added missing colon in payload. Thanks @lsm

0.4.3 / 2013-02-08
==================

  * package: removed unusued `parser.js`

0.4.2 / 2013-02-08
==================

  * polling-jsonp: fix ie6 JSONP on SSL
  * close also if socket.readyState is on "opening"
  * parser.js: removed the file package.json: added the engine.io-parser dependency everything else: switched to engine.io-parser
  * fix "TypeError: Object #<Object> has no method 'global'"
  * client now ignores unsupported upgrades

0.4.1 / 2013-01-18
==================

  * do not shadow global XMLHttpRequest
  * socket: added `data` event (as synonym to `message`)
  * socket: remove `resource` and fix `path`
  * socket: fixed access to `opts`
  * test: fixed transports tests
  * socket: constructor can accept uri/opts simultaneously
  * SPEC: simplified: removed resource from SPEC
  * socket: proper `host`/`hostname` support
  * socket: ensure `onclose` idempotency
  * socket: added `onerror` instrumentation
  * socket: fix style
  * use window to detect platform and fix global reference
  * *: fix references to `global` (fixes #79)

0.4.0 / 2012-12-09
==================

  * *: now based on `component(1)`
  * *: module now exports `Socket`
  * socket: export constructors, utils and `protocol`
  * *: implemented `emitter` component
  * *: removed browserbuild and preprocessor instructions

0.3.10 / 2012-12-03
===================

  * socket: fix closing the socket in an `open` listener [mmastrac]
  * socket: perform ping interval/timer cleanup [mmastrac]
  * fix SPEC (packages -> packets) [jxck]
  * socket: handle probe's transport errors [indutny]

0.3.9 / 2012-10-23
==================

  * socket: fix `hostname` instead of `host`
  * socket: avoid duplicate `port` defaults

0.3.8 / 2012-10-23
==================

  * socket: introduce introspection hooks
  * socket: introduced `host` and `port` `location` defaults
  * flashsocket: obfuscate activex (fixes #31)
  * README: documented reconnect (closes #45)
  * socket: unset `id` upon close
  * socket: clear transport listeners upon force close

0.3.7 / 2012-10-21
==================

  * fix `version` [quackingduck]
  * ping timeout gets reset upon any packet received [indutny]
  * timeout fixes [cadorn, indutny]
  * transport: fix xdomain detection in absence of location.port (GH-38)
  * socket: fix passing `false` as secure getting overridden
  * socket: default `secure` to `true` for SSL-served pages
  * socket: fix default port for SSL when `secure` is not supplied

0.3.6 / 2012-10-16
==================

  * socket: reset timeout on any incoming data [indutny]

0.3.5 / 2012-10-14
==================

  * new build

0.3.4 / 2012-10-14
==================

  * package: fix `component` exports

0.3.3 / 2012-10-10
==================

  * socket: fix `secure` default value discovery [quackingduck]

0.3.2 / 2012-10-08
==================

  * Bump

0.3.1 / 2012-10-08
==================

  * socket: added `write` alias for `send`
  * package: added `component`

0.3.0 / 2012-09-04
==================

  * IE's XDomainRequest cannot do requests that go from HTTPS to HTTP or HTTP to HTTPS [mixu]
  * Switch to client-initiated ping, and set interval in handshake [cadorn]

0.2.2 / 2012-08-26
==================

  * polling-jsonp: allow unneeded global leak (fixes #41)
  * polling-jsonp: allow for multiple eio's in the same page

0.2.1 / 2012-08-13
==================

  * Bump

0.2.0 / 2012-08-06
==================

  * polling: introduced `poll` and `pollComplete` (formerly `poll`) events

0.1.2 / 2012-08-02
==================

  * Bump

0.1.1 / 2012-08-01
==================

  * Added options for request timestamping
  * Made timestamp query param customizable
  * Added automatic timestamping for Android

0.1.0 / 2012-07-03
==================

  * Initial release.
