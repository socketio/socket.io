// https://developer.mozilla.org/en/New_in_JavaScript_1.7

function range(begin, end) {
  for (let i = begin; i < end; ++i) {
    yield i;
  }
}
var ten_squares = [i * i for each (i in range(0, 10))];
var evens = [i for each (i in range(0, 21)) if (i % 2 == 0)];

// test optimization
var optimized = [i for each (i in x) if (0)];

[i for each (a in x) for each (b in y)]
