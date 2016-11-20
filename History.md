
1.8.0 / 2016-11-20
===================

  * [fix] Fixed regression creating connection over https from node (#513)
  * [fix] Fixed regression creating connection over wss from node (#514)
  * [feature] Enable definition of timeouts for xhr-polling (#456)
  * [feature] Added flag forceNode to override the normal behavior of prefering Browser based implementations. (#469)
  * [feature] add localAddress option (#487)
  * [chore] update dependencies (#516)
  * [chore] Speed up lint by avoiding '**/*.js' matching pattern (#517)
  * [chore] Bump debug to version 2.3.3 (#520)

1.7.2 / 2016-10-24
===================

  * [fix] Set accept header to */* to support react app proxy (#508)
  * [fix] remove a workaround for ios (#465)
  * [fix] onPacket now emits data on 'closing' state as well (#484)
  * [fix] Obfuscate `ActiveXObject` occurrences (#509)
  * [docs] Add missing `onlyBinaryUpgrades` option in the docs (#510)
  * [chore] Add Github issue and PR templates (#511)

1.7.1 / 2016-10-20
===================

  * [fix] Define "requestsCount" var and "requests" hash unconditionally (#490)
  * [perf] Add all properties to the socket in the constructor (#488)
  * [chore] Update zuul browser settings (#504)
  * [chore] Bump engine.io-parser to 1.3.1 (#505)
  * [chore] Use more-specific imports for StealJS compatibility (#467)

1.7.0 / 2016-10-05
===================

  * [fix] Revert "default `rejectUnauthorized` to `true`" (#496)
  * [fix] Use xhr.responseText if xhr.response is not provided (#483)
  * [fix] Fix issue with errors during WebSocket creation not being caught (#475)
  * [style] Add missing semi-colon (#501)
  * [chore] Add gulp & babel in the build process (#455)
  * [chore] Add eslint (#458)
  * [chore] Bump zuul (#464)
  * [chore] Remove unused submodule (#466)
  * [chore] Bumping ws to 1.1.1 (#478)
  * [chore] Update zuul browser settings following EOL notices (#486)
  * [chore] Bump engine.io-parser (#492)
  * [chore] Make the build status badge point towards master (#497)
  * [chore] Bump zuul to 3.11.0 & zuul-ngrok to 4.0.0 (#498)
  * [chore] Restrict files included in npm package (#499)

1.6.11 / 2016-06-23
===================

  * bump version

1.6.10 / 2016-06-23
===================

  * bump version

1.6.9 / 2016-05-02
==================

  * default `rejectUnauthorized` to `true`

1.6.8 / 2016-01-25
==================

  * safely resolve `ws` module

1.6.7 / 2016-01-10
==================

  * prevent `ws` from being added to the bundle
  * added jsonp fix for when no `<script>` is found

1.6.6 / 2016-01-07
==================

  * support: add fallback to `global` for nativescript [@ligaz]
  * exclude `ws` instead of ignoring it from build [@lpinca]

1.6.5 / 2016-01-05
==================

  * package: bump `ws` for sec advisory

1.6.4 / 2015-12-04
==================

  * ipv6 url support
  * README: fix the description of the `timestampRequests` option
  * transports: use `yeast` to generate the cache busting id
  * fix arraybuffer > base64 for binary sends

1.6.3 / 2015-12-01
==================

  * remove compress option from control packets
  * threshold for permessage-deflate

1.6.2 / 2015-11-30
==================

  * package: bump `ws` for memory fix with compression
  * fix response parsing error for polling (unused)

1.6.1 / 2015-11-28
==================

  * fix packet options that `ws` changes [Nibbler999]
  * package: use published `engine.io-parser`

1.6.0 / 2015-11-28
==================

  * test with travis containers
  * socket: remove duplicate declaration (fixes #434)
  * package: bump `debug` (fixes #433)
  * bump zuul and zuul-ngrok
  * package: fix repository url
  * bump `ws` for several improvements
  * fix rejectUnauthorized bug
  * websocket: improve firing of `drain` in websocket transport
  * socket: clean up buffers right after `close` event
  * change semantics of the write callback for polling
    (fire upon flush instead drain)
  * socket: fix host parsing for IPv6 URLs
  * socket: handle parser errors appropriately
  * expose `ping` and `pong` events
  * enable `supportsBinary` when running as a node client
  * introduce `extraHeaders` support
  * fix error when passing `WebSocket#send` second argument on Safari
  * support compression

1.5.4 / 2015-09-09
==================

  * package: bump `engine.io-parser`

1.5.3 / 2015-09-09
==================

  * package: bump `ws` to fix node 0.4.0

1.5.2 / 2015-07-09
==================

  * package: bump `ws` to fix windows build issues

1.5.1 / 2015-01-19
==================

 * do not rely on `git(1)` for dep, point to tarball instead

1.5.0 / 2015-01-18
==================

 * package: bump `engine.io-parser`
 * fix IE tests firing too many connections [rase-]
 * fix default port detection when host is specified [defunctzombie]
 * add support for custom SSL options in constructor [rase-]
 * only call xhr.abort() on error cases in `polling-xhr` [samcday]

1.4.3 / 2014-11-21
==================

 * support: make the build system work with the latest browserify
 * test: remove test with partial browser support
 * Fixed calls to addEventListener in old browsers

1.4.2 / 2014-10-27
==================

 * remove invalid value for strict mode
 * IE10 should prefer using XHR2 over XDR because it's safer
 * fixed transport close deferring logic [nkzawa]
 * wait for buffer to be drained before closing [nkzawa]

1.4.1 / 2014-10-03
==================

 * Fixed "jsonp polling iframe removal error"
 * Move ws upgrade needing connection tests to a block checking browser support.
 * check `readyState` in `sendPacket` and close on `upgradeError` too
 * defer close while upgrading a transport

1.4.0 / 2014-09-03
==================

 * add matrix support for travis runs.
 * add `enablesXDR` option to turn on `XDomainRequest`
 * package: bump `browserify`
 * package: bump `engine.io-parser`
 * style and close socket after assert
 * add support for `jsonp` option to turn it off

1.3.1 / 2014-06-19
==================

 * transport: catch utf8 decode errors

1.3.0 / 2014-06-13
==================

 * smaller inherits utility
 * fix a test for ws
 * upgrade emitter dep to not rely on tarball

1.2.2 / 2014-05-30
==================

 * package: bump `engine.io-parser` for binary utf8 fix

1.2.1 / 2014-05-22
==================

 * build

1.2.0 / 2014-05-18
==================

 * removed flashsocket, moving to userland
 * new build

1.1.1 / 2014-05-14
==================

 * jsonp-polling: fixed newline double escaping
 * package: bump parser
 * remove legacy Socket#onopen call
 * added tests for multibyte strings

1.1.0 / 2014-04-27
==================

 * bump zuul version
 * renamed removeAllListeners to cleanup
 * use inherits package instead of inherit
 * removed all references to util.js
 * fix if statement in FlashWS.ready method
 * polling-jsonp: prevent spurious errors from being emitted when the window is unloaded
 * polling-xhr: fix a comment and remove unneeded `document` reference
 * enforce cache busting for all user agents
 * JSONP and test fixes for fails in IE
 * package: bump `engine.io-parser`
 * polling-xhr: abort the request when the window is unloaded

1.0.5 / 2014-03-18
==================

 * package: bump `engine.io-parser` for android binary fix

1.0.4 / 2014-03-14
==================

 * no base64 encoding for no reason when using websockets

1.0.3 / 2014-03-12
==================

 * fix browserify

1.0.2 / 2014-03-12
==================

 * bump `engine.io-parser`
 * made `parseJSON` and `parseURI` from `util` their own modules [gkoren]
 * clean up tests
 * clean up browserify

1.0.1 / 2014-03-06
==================

 * package: bump `engine.io-parser`

1.0.0 / 2014-03-06
==================

 * run browserify without shims
 * emit socket upgrade event after upgrade done
 * better feature detection for XHR2
 * added `rememberUpgrade` option
 * binary support

0.9.0 / 2014-02-09
==================

 * Fix simple `host:port` URLs and IPV6 [bmalehorn]
 * Fix XHR cleanup method [poohlty]
 * Match semantics of `close` event with `WebSocket`. If an error occurs
   and `open` hadn't fired before, we still emit `close` as per
   WebSocket spec [mokesmokes].
 * Removed SPEC (now in `engine.io-protocol` repository)
 * Remove `Socket#open` docs (private API) [mokesmokes]

0.8.2 / 2014-01-18
==================

 * polling-xhr: avoid catching user-thrown errors
 * util: remove unused `hasCORS`
 * polling: remove deferring for faster startup (fixes #174)
 * engine now works perfectly on workers

0.8.1 / 2014-01-17
==================

 * package: bump debug to fix `localStorage` issue (fixes #213)
 * remove duplicate xmlhttprequest code
 * add iphone automated testing
 * bump zuul to 1.3.0 to improve tests performance
 * use invalid ip address for incorrect connection test
 * Fix GH-224, remove sockets array

0.8.0 / 2014-01-05
==================

 * socket: emit upgrade errors as `upgradeError` instead of `error`

0.7.14 / 2014-01-01
===================

 * test: increase timeouts for network tests
 * test: whitelist globals
 * test: improve socket closing test
 * polling: improve url timestamp for ie11 and allow force disabling
 * polling-xhr: handle errors for xhr creation (fixes `access denied` issues)
 * polling-xhr: style
 * socket: more instrumentation for transport creation
 * socket: allow explicit `false` for `timestampRequests`
 * socket: accept `null` as first argument
 * Makefile: cleanup
 * .travis: deprecate 0.6

0.7.13 / 2013-12-20
===================

 * use `jsonp` in favor of `XDomainRequest` to preserve `Cookie`
   headers in all situations [3rd-eden] (fixes #217)
 * run zuul tests after node tests [defunctzombie]
 * add zuul support for easier browser testing [defunctzombie]

0.7.12 / 2013-11-11
===================

 * engine.io: updated build to fix WebSocket constructor issue
 * package: move browserify into devDeps

0.7.11 / 2013-11-06
===================

 * AMD support
 * Makefile: build now smaller thanks to browserify
 * add browserify support

0.7.10 / 2013-10-28
===================

 * fixed issue which prevented IE9 and under to pass Cookies to server during handshake
 * package: update "ws" to v0.4.31
 * fixed - there is no host property only hostname
 * fixed - flash socket creation
 * fixed - emit errors thrown by xhr.send()

0.7.9 / 2013-08-30
==================

 * websocket: pass `undefined` as the WebSocket "protocols"

0.7.8 / 2013-08-30
==================

 * package: update "ws"

0.7.7 / 2013-08-30
==================

 * package: bump ws to 0.4.30
 * websocket: no more env sniffing, just require `ws` [TooTallNate]
 * websocket: remove the "bufferedAmount" checking logic [TooTallNate]

0.7.6 / 2013-08-30
==================

 * package: revert ws to avoid upgrade fail now

0.7.5 / 2013-08-30
==================

 * package: bump ws to 0.4.30

0.7.4 / 2013-08-25
==================

 * package: rolling back to `ws` `0.4.25` due to disconnection bug

0.7.3 / 2013-08-23
==================

 * noop bump

0.7.2 / 2013-08-23
==================

 * transports: fix WebSocket transport in the web browser (again)

0.7.1 / 2013-08-23
==================

 * transports: fix WebSocket transport in the web browser
 * package: upgrade "ws" to v0.4.29

0.7.0 / 2013-08-23
==================

 * socket: add `agent` option
 * package: point "xmlhttprequest" to our LearnBoost fork for agent support
 * package: specify a newer version of "ws" that includes `agent` support
 * util: use "component/has-cors"
 * transport: fix whitespace
 * util: use "component/global"
 * package: Add repository field to readme
 * socket: Don't lose packets writen during upgrade after a re-open
 * socket: use a consistent "debug" name for socket.js
 * package: Update emitter dep to 1.0.1 for old IE support

0.6.3 / 2013-06-21
==================

  * fix check readyState in polling transport (Naoyuki Kanezawa)
  * use http url in npm dependencies for emitter (Eric Schoffstall)

0.6.2 / 2013-06-15
==================

  * transports: improve polling orderly close (fixes #164)
  * socket: ignore further transport communication upon `onClose`
  * socket: added missing `socket#onerror` support
  * socket: don't call `socket#onclose` if previous state was not `open`
  * transports: fix iOS5 crash issue
  * Makefile: extra precaution when building to avoid 0.6.0 build problem

0.6.1 / 2013-06-06
==================

  * engine.io: fixed build

0.6.0 / 2013-05-31
==================

  * does not emit close on incorrect socket connection
  * use indexof component for ie8 and below
  * improved x-domain handling
  * introduce public `ping` api
  * added drain event
  * fix `flush` and `flushComplete` events
  * fixed `drain` bug splicing with upgrading
  * add support for callbacks with socket.send()

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
