function x() {}

function x() {
  ;
}

function x() {
  x();
  return 'x';
}

function x(a) {
  x();
}

function x(a, b) {
  x();
}

x = function() {
  x();
};

(function () {
  print('x');
})();

(function (a) {
  print('x');
})(1);

(function (a, b) {
  print('x');
})(1, 2);

(function () {
  print('x');
}).call(window);
