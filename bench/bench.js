var bencher = require('./index');
bencher(function(benchmark) {
  function logMean(test) {
    console.log(test.name + ' mean run time: ' + test.stats.mean);
  }

  for (var i = 0; i < benchmark.length; i++) {
    logMean(benchmark[i]);
  }
});
