
/**
 * UA / engines detection namespace.
 *
 * @namespace
 */

exports.ua = {};

/**
 * Detect webkit.
 *
 * @api private
 */

exports.ua.webkit = 'undefined' != typeof navigator &&
  /webkit/i.test(navigator.userAgent);

/**
 * Detect gecko.
 *
 * @api private
 */

exports.ua.gecko = 'undefined' != typeof navigator &&
  /gecko/i.test(navigator.userAgent);

/**
 * Detect android;
 */

exports.ua.android = 'undefined' != typeof navigator &&
  /android/i.test(navigator.userAgent);

/**
 * Detect iOS.
 */

exports.ua.ios = 'undefined' != typeof navigator &&
  /^(iPad|iPhone|iPod)$/.test(navigator.platform);
exports.ua.ios6 = exports.ua.ios && /OS 6_/.test(navigator.userAgent);

/**
 * Detect Chrome Frame.
 */

exports.ua.chromeframe = Boolean(global.externalHost);
