
/**
 * Export transports.
 */

module.exports = {
    websocket: require('./websocket')
  , htmlfile: require('./htmlfile')
  , 'xhr-polling': require('./xhr-polling')
  , 'xhr-multipart': require('./xhr-multipart')
  , 'jsonp-polling': require('./jsonp-polling')
};
