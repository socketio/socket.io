
/**
 * Export websocket versions.
 */

module.exports = {
  7: require('./hybi'),
  8: require('./hybi'),
  13: require('./hybi'),
  default: require('./default')
};
