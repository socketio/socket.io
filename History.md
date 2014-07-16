
1.1.0 / 2014-07-16
==================

 * make utf8 encoding/decoding optional

1.0.8 / 2014-07-16
==================

 * adjust protocol revision
 * handle invalid utf8 errors gracefully
 * fix memory leak on browser

1.0.7 / 2014-06-24
==================

 * fix decodePayloadAsBinary memory leak [christophwitzko]
 * README improvements

1.0.6 / 2014-05-30
==================

 * utf8 fixes when using binary encoding [nkzawa]

1.0.5 / 2014-05-06
==================

 * fix range error

1.0.4 / 2014-04-13
==================

 * fix `encodePayloadAsBinary` method encodes packets to base64

1.0.3 / 2014-04-10
==================

 * Fix length calculation when encoding as binary [binlain]

1.0.2 / 2014-03-16
==================

 * fix binary for android due to a bug in Blob XHR2 implementation [Rase-]

1.0.1 / 2014-03-06
==================

 * implement `blob` module to simplify code
 * bump `arraybuffer.slice`
 * style fixes

1.0.0 / 2014-02-18
==================

 * parser: added binary encoding [Rase-]
 * parser: switched to an async interface [Rase-]

0.3.0 / 2013-03-16
==================

  * parser: if callback returns `false` ignore rest of payload
  * test: fixed all broken tests

0.2.1 / 2013-03-16
==================

  * added protocol version to index.js [albertyfwu]

0.2.0 / 2013-02-26
==================

  * Changed `decodePayload` to use a callback instead of returning an array [sweetieSong, albertyfwu]

0.1.1 / 2013-01-26
==================

  * package.json fixes

0.1.0 / 2013-01-19
==================

  * Initial release
