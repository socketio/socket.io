var blobSupported = (function() {
  try {
    new Blob(['hi']);
    return true;
  } catch(e) {}
  return false;
})();

/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MSBlobBuilder || global.MozBlobBuilder;
var blobBuilderSupported = !!BlobBuilder && !!BlobBuilder.prototype.append && !!BlobBuilder.prototype.getBlob;

if (global.ArrayBuffer) {
  require('./arraybuffer.js');
}

if (blobSupported || blobBuilderSupported) {
  require('./blob.js');
}
