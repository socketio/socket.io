/**
 * Gets the keys for an object.
 *
 * @return {Array} keys
 * @api private
 */

module.exports =
  Object.keys ||
  function keys(obj) {
    const arr = [];
    const has = Object.prototype.hasOwnProperty;

    for (let i in obj) {
      if (has.call(obj, i)) {
        arr.push(i);
      }
    }
    return arr;
  };
