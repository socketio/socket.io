
/**

# s.js: minimalistic javascript sprintf().

    // standalone
    s('http://%s:%d', 'localhost', 40)
    s('got %j', { this: 'will be JSON.stringified' })

    // extend String.prototype
    s.extend();
    'http://%s:%d'.s('localhost', 40);

Only supports `%s` and `%d`. Escape `%` as `%%`.

**/

(function (g) {
  var j = 'undefined' != typeof JSON ? JSON.stringify : String;

  function s (str) {
    var i = 1, args = arguments;
    return String(str).replace(/%?%(d|s|j)/g, function (symbol, type) {
      if ('%' == symbol[1]) return symbol;
      var arg = args[i++];
      switch (type) {
        case 'd': return Number(arg);
        case 'j': return j(arg);
      }
      return String(arg);
    });
  };

  s.extend = function () {
    String.prototype.s = function () {
      var arr = [this];
      arr.push.apply(arr, arguments)
      return s.apply(null, arr);
    }
  }
  g.top ? g.s = s : module.exports = s;
})(this);
