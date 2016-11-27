
1.7.0 / 2016-11-27
==================

  * [chore] Move generated files to `dist` folder (#1025)
  * [chore] Provide a slim build without JSON3 and debug (#1030)
  * [chore] Bump engine.io-client to 1.8.1 (#1032)

1.6.0 / 2016-11-20
==================

  * [feature] emit sourcemap for socket.io.js (#953)
  * [feature] Support minified `socket.io.min.js` (#1021)
  * [chore] Bump dependencies (#1026)

1.5.1 / 2016-10-24
==================

  * [chore] Disable AMD for json3 (#1005)
  * [chore] Bump socket.io-parser to 2.3.0 (#1009)
  * [chore] Bump engine.io-client to 1.7.1 (#1010)
  * [chore] Update zuul browser settings (#1011)
  * [chore] Add Github issue and PR templates (#1013)
  * [chore] Bump engine.io-client to 1.7.2 and socket.io-parser to 2.3.1 (#1015)

1.5.0 / 2016-10-06
==================

  * [fix] Fix query string management (#943)
  * [chore] Add gulp & babel in the build process (#940)
  * [chore] Add eslint (#951)
  * [chore] bump zuul (#958)
  * [chore] Remove jspm browser config (#957)
  * [chore] Update zuul browser settings following EOL notices (#985)
  * [chore] Bump zuul to 3.11.0 & zuul-ngrok to 4.0.0 (#997)
  * [chore] reference build badge to master branch (#967)
  * [chore] Bump engine.io-client to 1.7.0 (#996)
  * [chore] Restrict files included in npm package (#998)

1.4.8 / 2016-06-23
==================

  * package: bump `engine.io-client`

1.4.7 / 2016-06-23
==================

  * bump engine.io-client

1.4.6 / 2016-05-02
==================

  * bump engine.io-client

1.4.5 / 2016-01-26
==================

  * fix `NativeScript` support

1.4.4 / 2016-01-10
==================

  * bump `engine.io-client`

1.4.3 / 2016-01-08
==================

  * remove `webpack.config.js`

1.4.2 / 2016-01-07
==================

  * exclude `ws` instead of `ignore`ing it from build [@lpinca]
  * add global object as another fallback [@ligaz]
  * bump `engine.io-client`

1.4.1 / 2016-01-07
==================

  * package: bump `engine.io-client`

1.4.0 / 2015-11-28
==================

  * package: bump `engine.io-client`
  * manager: fix `Object.prototype` extensions
  * package: bump `zuul` and `zuul-ngrok`
  * package: bump `debug`
  * package: bump `socket.io-parser`
  * package: bump `has-binary`
  * remove unnecessary `index.js`
  * added support for `ping` and `pong` events
  * proper handling of disconnection while in `opening` state
  * instrumentation / style tweaks
  * added tests for same-namespace new connection handling
  * do not call apply if packet id is not in acks
  * build sio client with make to autogenerate new socket.io.js
  * bugfix/1956 don't reuse same-namespace connections #2
  * fix has-binary to work with all objects [gunta]
  * bugfix/1956 don't reuse same-namespace connections
  * add support for compression [nkzawa]
  * fix: location.port was ignored

1.3.7 / 2015-09-21
==================

  * package: bump `socket.io` for node4 support
  * package: bump `engine.io-client` for node4 compatibility

1.3.6 / 2015-07-14
==================

  * package: bump `engine.io-client` to fix build on windows

1.3.5 / 2015-03-03
==================

 * package: bump parser

1.3.4 / 2015-02-14
==================

 * build `socket.io.js` with `engine.io-client` `1.5.1`

1.3.3 / 2015-02-03
==================

 * package: bump parser

1.3.2 / 2015-01-19
==================

 * build `socket.io.js`

1.3.1 / 2015-01-19
==================

 * no change on this release
 * package: bump `engine.io-client` to not depend on `git(1)` for a dep

1.3.0 / 2015-01-19
==================

 * package: bump `engine.io-client`
 * added `socket.id` property pointing to session id [rase-]
 * fix url parsing when uri string is undefined [defunctzombie]
 * implemented `backo` for exponential backoff with randomization [mokesmokes]
 * reset reconnection attempts state after a successul connection [mokesmokes]

1.2.1 / 2014-11-21
==================

 * package: bump `engine.io-client`
 * README: fixes to prevent duplicate events [nkzawa]
 * fix reconnection after reconnecting manually [nkzawa]
 * make ACK callbacks idempotent [thexeos]
 * package: bump `uglify-js`

1.2.0 / 2014-10-27
==================

 * bump `engine.io-client`.
 * set `readyState` before engine.io close event
 * fix reconnection after reconnecting manually
 * enable to stop reconnecting
 * downloads badge
 * support no schema relative url
 * enable to reconnect manually

1.1.0 / 2014-09-04
==================

 * socket: fix in `has-binary`
 * package: bump `socket.io-parser`
 * package: bump `engine.io-client`
 * further increase test timeout.
 * double to singly quotes in tests.
 * extend timeout and remember to close everything in each test case
 * fix travis
 * add travis + zuul matrix
 * use svg instead of png to get better image quality in readme
 * make CI build faster
 * removed unnecessary code from try block. Only decode packet is needed.
 * package: bump `browserify`
 * package: bump `engine.io-client`
 * fix autoConnect option
 * npmignore: ignore `.gitignore`
 * package: update `browserify`
 * don't fire an extra reconnect when we're not reconnecting
   after a failed initial connect attempt
 * package: bump `socket.io-parser` for `component-emitter` dep fix
 * updated tests to reflect `autoConnect` option
 * add `autoConnect` option to wait with connecting

1.0.6 / 2014-06-19
==================

 * test fixes on internet explorer
 * fixes for duplicate event propagation from manager instance [Rase-]

1.0.5 / 2014-06-16
==================

 * package: bump `engine.io-client` for better deps and smaller build
 * handle io.connect(null, opts) correctly [audreyt]
 * url: fix incorrect ports in certain connections [holic]
 * manager: propagate all reconnection events to sockets [Rase-]
 * index: added BC for `force new connection`
 * socket: fix event buffering while in disconnected state [kevin-roark]
 * package: stop using tarballs in dependencies [reid]
 * manager: relay `connect_error` and `connect_timeout` to sockets

1.0.4 / 2014-06-02
==================

 * update build

1.0.3 / 2014-05-31
==================

 * package; bump `socket.io-parser` for binary ACK fix
 * package: bump `engine.io-client` for binary UTF8 fix

1.0.2 / 2014-05-28
==================

 * package: bump `socket.io-parser` for windows fix

1.0.1 / 2014-05-28
==================

 * override npm tag

1.0.0 / 2014-05-28
==================

 * stable release

1.0.0-pre5 / 2014-05-22
=======================

 * package: bump `engine.io-client` for parser fixes

1.0.0-pre4 / 2014-05-19
=======================

 * build

1.0.0-pre3 / 2014-05-17
=======================

 * package: bump parser
 * package: bump engine.io-client

1.0.0-pre2 / 2014-04-27
=======================

 * package: bump `engine.io-client`
 * package: bump `zuul`
 * allows user-level query string parameters to be in socket.request
 * package: bump `socket.io-parser`
 * package: bump `engine.io-client` for android fix
 * tidy up .gitignore

1.0.0-pre / 2014-03-14
======================

 * implemented `engine.io-client`
 * implemented `socket.io-parser`
 * implemented `json3` to avoid env pollution
 * implemented `debug`
 * added binary support
 * added `browserify` support

0.9.11 / 2012-11-02
===================

  * Enable use of 'xhr' transport in Node.js
  * Fix the problem with disconnecting xhr-polling users
  * Add should to devDependencies
  * Prefer XmlHttpRequest if CORS is available
  * Make client compatible with AMD loaders.

0.9.10 / 2012-08-10
===================

  * fix removeAllListeners to behave as expected.
  * set withCredentials to true only if xdomain.
  * socket: disable disconnect on unload by default.

0.9.9 / 2012-08-01
==================

  * socket: fixed disconnect xhr url and made it actually sync
  * *: bump xmlhttprequest dep

0.9.8 / 2012-07-24
==================

  * Fixed build.

0.9.7 / 2012-07-24
==================

  * iOS websocket crash fix.
  * Fixed potential `open` collision.
  * Fixed disconnectSync.

0.9.6 / 2012-04-17
==================

  * Don't position the jsonp form off the screen (android fix).

0.9.5 / 2012-04-05
==================

  * Bumped version.

0.9.4 / 2012-04-01
==================

  * Fixes polling loop upon reconnect advice (fixes #438).

0.9.3 / 2012-03-28
==================

  * Fix XHR.check, which was throwing an error transparently and causing non-IE browsers to fall back to JSONP [mikito]
  * Fixed forced disconnect on window close [zzzaaa]

0.9.2 / 2012-03-13
==================

  * Transport order set by "options" [zzzaaa]

0.9.1-1 / 2012-03-02
====================

  * Fixed active-x-obfuscator NPM dependency.

0.9.1 / 2012-03-02
==================

  * Misc corrections.
  * Added warning within Firefox about webworker test in test runner.
  * Update ws dependency [einaros]
  * Implemented client side heartbeat checks. [felixge]
  * Improved Firewall support with ActiveX obfuscation. [felixge]
  * Fixed error handling during connection process. [Outsideris]

0.9.0 / 2012-02-26
==================

  * Added DS_Store to gitignore.
  * Updated depedencies.
  * Bumped uglify
  * Tweaking code so it doesn't throw an exception when used inside a WebWorker in Firefox
  * Do not rely on Array.prototype.indexOf as it breaks with pages that use the Prototype.js library.
  * Windows support landed
  * Use @einaros ws module instead of the old crap one
  * Fix for broken closeTimeout and 'IE + xhr' goes into infinite loop on disconnection
  * Disabled reconnection on error if reconnect option is set to false
  * Set withCredentials to true before xhr to fix authentication
  * Clears the timeout from reconnection attempt when there is a successful or failed reconnection. 
    This fixes the issue of setTimeout's carrying over from previous reconnection
    and changing (skipping) values of self.reconnectionDelay in the newer reconnection.
  * Removed decoding of parameters when chunking the query string.
    This was used later on to construct the url to post to the socket.io server
    for connection and if we're adding custom parameters of our own to this url
    (for example for OAuth authentication) they were being sent decoded, which is wrong.

0.8.7 / 2011-11-05
==================

  * Bumped client

0.8.6 / 2011-10-27 
==================

  * Added WebWorker support.
  * Fixed swfobject and web_socket.js to not assume window.
  * Fixed CORS detection for webworker.
  * Fix `defer` for webkit in a webworker.
  * Fixed io.util.request to not rely on window.
  * FIxed; use global instead of window and dont rely on document.
  * Fixed; JSON-P handshake if CORS is not available.
  * Made underlying Transport disconnection trigger immediate socket.io disconnect.
  * Fixed warning when compressing with Google Closure Compiler.
  * Fixed builder's uglify utf-8 support.
  * Added workaround for loading indicator in FF jsonp-polling. [3rd-Eden]
  * Fixed host discovery lookup. [holic]
  * Fixed close timeout when disconnected/reconnecting. [jscharlach]
  * Fixed jsonp-polling feature detection.
  * Fixed jsonp-polling client POSTing of \n.
  * Fixed test runner on IE6/7

0.8.5 / 2011-10-07
==================

  * Bumped client

0.8.4 / 2011-09-06
==================

  * Corrected build

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

