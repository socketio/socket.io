
/**
 * Module dependencies.
 */

var qs = require('qs');

module.exports = function(res, fn){
  var buf = '';
  res.setEncoding('ascii');
  res.on('data', function(chunk){ buf += chunk; });
  res.on('end', function(){
    try {
      fn(null, qs.parse(buf));
    } catch (err) {
      fn(err);
    }
  });
};