
/**
 * Merge `a` <= `b`
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Object} b
 */

exports.merge = function(a, b){
  for (var k in b) a[k] = b[k];
  return a;
};
