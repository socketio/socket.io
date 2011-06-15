'use strict';

/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

var defaultPolicy =
  '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM' +
  ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n' +
  '<allow-access-from domain="*" to-ports="*"/>\n' +
  '</cross-domain-policy>\n';

// TODO: ?

/***
  listeners.forEach(function(l){
    [].concat(l.options.origins).forEach(function(origin){
      var parts = origin.split(':');
      xml += '<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>\n';
    });
  });
***/

function answer(stream) {
  if (stream && (stream.readyState === 'open' || socket.readyState === 'writeOnly')) {
    stream.end(defaultPolicy);
  }
}

exports = module.exports = function(manager) {
  var server = require('net').createServer(function(stream) {
    stream.on('error', function(err) {
      if (stream && stream.end) {
        stream.end();
        stream.destroy();
      }
    });
    manager.log.debug('Answering flash policy request');
    answer(stream);
  });
  try {
    var port = manager.get('flash policy port') || 843;
    server.listen(port);
    manager.log.info('flash policy server started on port', port);
  } catch(err) {
    if (err.errno === 13) {
      manager.log.warn(
        'Your node instance does not have root privileges. ' +
        'This means that the flash XML policy file will be ' +
        'served inline instead of on port 843. This will slow ' +
        'down initial connections slightly.'
      );
      manager.log.info('flash policy inline server started');
      manager.server.on('connection', function(stream) {
        stream.once('data', function (data) {
          // Only check the initial data
          if (data[0] === 60 && data.length >= 23) {
            if (data.toString() === '<policy-file-request/>\0') {
              manager.log.debug('answering flash policy request inline');
              answer(stream);
            }
          }
        });
      });
    } else {
      throw err;
    }
  }
};
