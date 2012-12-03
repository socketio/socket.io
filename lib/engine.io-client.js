
/**
 * Client version.
 *
 * @api public.
 */

exports.version = '0.3.10';

/**
 * Protocol version.
 *
 * @api public.
 */

exports.protocol = 1;

/**
 * Utils.
 *
 * @api public
 */

exports.util = require('./util');

/**
 * Parser.
 *
 * @api public
 */

exports.parser = require('./parser');

/**
 * Socket constructor.
 *
 * @api public.
 */

exports.Socket = require('./socket');

/**
 * Export EventEmitter.
 */

exports.EventEmitter = require('./event-emitter');

/**
 * Export Transport.
 */

exports.Transport = require('./transport');

/**
 * Export transports
 */

exports.transports = require('./transports');
