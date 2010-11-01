// https://developer.mozilla.org/en/New_in_JavaScript_1.7

[a, b] = [b, a];

function f() {
  return [1, 2];
}
[a, b] = f();

for (let [name, value] in Iterator(obj)) {
  print(name);
  print(value);
}

for each (let {name: n, family: { father: f } } in people) {
  print(n);
  print(f);
}

var [a, , b] = f();
[,,,] = f();

function g() {
  var parsedURL = /^(\w+)\:\/\/([^\/]+)\/(.*)$/.exec(url);
  if (!parsedURL)
    return null;
  var [, protocol, fullhost, fullpath] = parsedURL;
}

function h(a, [b, c], {foo: d, 'bar': e}) {
  f();
  g();
}

x = function([a, b]) a + b;

({x: x0, y: y0}) = point;
var {x: x0, y: y0} = point;
let ({x: x0, y: y0} = point) {
  print(x0);
  print(y0);
}
