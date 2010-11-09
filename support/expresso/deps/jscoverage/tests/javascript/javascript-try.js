function f() {}

try {
  f();
}
catch (e) {
  f();
}

try {
  f();
}
catch (e if e instanceof E) {
  f();
}

try {
  f();
}
finally {
  f();
}

try {
  f();
}
catch (e) {
  f();
}
finally {
  f();
}
