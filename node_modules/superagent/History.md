
0.7.0 / 2012-08-03 
==================

  * allow `query()` to be called after the internal `req` has been created [tootallnate]

0.6.0 / 2012-07-17 
==================

  * add `res.send('foo=bar')` default of "application/x-www-form-urlencoded"

0.5.1 / 2012-07-16 
==================

  * add "methods" dep
  * add `.end()` arity check to node callbacks
  * fix unzip support due to weird node internals

0.5.0 / 2012-06-16 
==================

  * Added "Link" response header field parsing, exposing `res.links`

0.4.3 / 2012-06-15 
==================

  * Added 303, 305 and 307 as redirect status codes [slaskis]
  * Fixed passing an object as the url

0.4.2 / 2012-06-02 
==================

  * Added component support
  * Fixed redirect data

0.4.1 / 2012-04-13 
==================

  * Added HTTP PATCH support
  * Fixed: GET / HEAD when following redirects. Closes #86
  * Fixed Content-Length detection for multibyte chars

0.4.0 / 2012-03-04 
==================

  * Added `.head()` method [browser]. Closes #78
  * Added `make test-cov` support
  * Added multipart request support. Closes #11
  * Added all methods that node supports. Closes #71
  * Added "response" event providing a Response object. Closes #28
  * Added `.query(obj)`. Closes #59
  * Added `res.type` (browser). Closes #54
  * Changed: default `res.body` and `res.files` to {}
  * Fixed: port existing query-string fix (browser). Closes #57

0.3.0 / 2012-01-24 
==================

  * Added deflate/gzip support [guillermo]
  * Added `res.type` (Content-Type void of params)
  * Added `res.statusCode` to mirror node
  * Added `res.headers` to mirror node
  * Changed: parsers take callbacks
  * Fixed optional schema support. Closes #49

0.2.0 / 2012-01-05 
==================

  * Added url auth support
  * Added `.auth(username, password)`
  * Added basic auth support [node]. Closes #41
  * Added `make test-docs`
  * Added guillermo's EventEmitter. Closes #16
  * Removed `Request#data()` for SS, renamed to `send()`
  * Removed `Request#data()` from client, renamed to `send()`
  * Fixed array support. [browser]
  * Fixed array support. Closes #35 [node]
  * Fixed `EventEmitter#emit()`

0.1.3 / 2011-10-25 
==================

  * Added error to callback
  * Bumped node dep for 0.5.x

0.1.2 / 2011-09-24 
==================

  * Added markdown documentation
  * Added `request(url[, fn])` support to the client
  * Added `qs` dependency to package.json
  * Added options for `Request#pipe()`
  * Added support for `request(url, callback)`
  * Added `request(url)` as shortcut for `request.get(url)`
  * Added `Request#pipe(stream)`
  * Added inherit from `Stream`
  * Added multipart support
  * Added ssl support (node)
  * Removed Content-Length field from client
  * Fixed buffering, `setEncoding()` to utf8 [reported by stagas]
  * Fixed "end" event when piping

0.1.1 / 2011-08-20 
==================

  * Added `res.redirect` flag (node)
  * Added redirect support (node)
  * Added `Request#redirects(n)` (node)
  * Added `.set(object)` header field support
  * Fixed `Content-Length` support

0.1.0 / 2011-08-09 
==================

  * Added support for multiple calls to `.data()`
  * Added support for `.get(uri, obj)`
  * Added GET `.data()` querystring support
  * Added IE{6,7,8} support [alexyoung]

0.0.1 / 2011-08-05 
==================

  * Initial commit

