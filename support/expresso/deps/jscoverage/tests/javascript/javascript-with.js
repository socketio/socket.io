function f() {}
var x = {};

with (x) {
  f();
}

with (x)
  f();
