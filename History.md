
0.7.0 / 2011-??-??
==================

  * Fixed JSONP interaction with jQuery. [saschagehlich]
  * Fixed; different port now considered cross-domain.
  * Added compatibility for inclusion in non-browser environments.
  * Added package.json.
  * Added noConflict support. [kreichgauer]
  * Added reconnection support with exponential backoff. [3rd-Eden]

0.6.2 / 2011-02-05 
==================

  * Fixed problem with xhr-multipart buffering
  * Updated Flash websocket transport
  * Fixed tryTransportsOnConnectTimeout option 
  * Added 'connect_failed' event after the last available transport fails to connect
  within the timeout 
  * Add 'connecting' event emit on each connection attempt.

