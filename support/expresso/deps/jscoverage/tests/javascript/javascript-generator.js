// https://developer.mozilla.org/en/New_in_JavaScript_1.7

function fib() {
  var i = 0, j = 1;
  while (true) {
    yield i;
    var t = i;
    i = j;
    j += t;
  }
}
