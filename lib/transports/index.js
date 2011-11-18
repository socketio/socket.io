
/**
 * Export transports.
 */

module.exports = {
    polling: require('./polling')
  , websocket: require('./websocket')
  , flashsocket: require('./flashsocket')
};
