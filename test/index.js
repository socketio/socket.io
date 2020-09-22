const env = require('./support/env.js');

const blobSupported = (function () {
  try {
    new Blob(['hi']);
    return true;
  } catch (e) {
  }
  return false;
})();

/**
 * Create a blob builder even when vendor prefixes exist
 */
const BlobBuilderRef = typeof BlobBuilder !== 'undefined' ? BlobBuilder :
  typeof WebKitBlobBuilder !== 'undefined' ? WebKitBlobBuilder :
    typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder :
      typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder : false;
const blobBuilderSupported = !!BlobBuilderRef && !!BlobBuilderRef.prototype.append && !!BlobBuilderRef.prototype.getBlob;

require('./parser.js');

if (!env.browser) {
  require('./buffer.js');
}

if (typeof ArrayBuffer !== 'undefined') {
  require('./arraybuffer.js');
}

if (blobSupported || blobBuilderSupported) {
  require('./blob.js');
}
