// useful globals

var currentSuite, currentCase;

// loads common.js module
function load (test, fn) {
  module = {};
  $script('/test/' + test, function () {
    fn(module.exports);
  });
};

// load all tests
function run () {
  var tests = Array.prototype.slice.call(arguments)
    , i = 0;

  function complete () {
    $('body').append('<p>All suites completed</p>');
  };

  if (tests.length) {
    // load dom
    $('body').append('<ul class="test-list">');

    // run suites
    suite(tests[i], function check (res) {
      if (tests[++i]) {
        suite(tests[i], check);
      } else {
        complete();
      }
    });
  } else {
    complete();
  }
};

// gets keys for an object
function keys (obj) {
  if (Object.keys) return Object.keys(obj);

  var keys = [];

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      keys.push(i);
    }
  }

  return keys;
};

// runs a suite
function suite (file, fn) {
  var passed = {}
    , failed = {};

  // register current suite
  currentSuite = file;

  // inject test case
  var li = $('<li class="loading">').append(
    $('<span class="name">').append(
      $('<a>').attr('href', '/test/' + file).text(file)
    )
  ).appendTo('.test-list');

  // dynamically load module
  load(file, function (suite) {
    if (!suite) return;

    var start = new Date;

    function complete () {
      var ok = !keys(failed).length
        , elapsed = Math.round((new Date - start) / 1000);

      // update dom
      li.removeClass('loading');
      li.append('<span class="bullet">&bull;</span>');

      if (ok) {
        li.append(' all passed');
      } else {
        li.append(' failing test');
        li.addClass('test-failure');
      }

      li.append(
        $('<div class="details">')
          .html(
              'Passed: ' + keys(passed).length
            + ' &mdash; Failed: <em>' + keys(failed).length
            + '</em> &mdash; Elapsed: <em>' + elapsed
            + '</em> seconds &mdash; '
          )
          .append(
            $('<a>Show details</a>')
              .attr('href', '#')
              .click(function () {
                li.toggleClass('cases');
                $(this).text(
                  li.hasClass('cases')
                    ? 'Hide details'
                    : 'Show details'
                );
                return false;
              })
          )
      );

      var casesUl = $('<ul class="cases">').appendTo(li);
      for (var i = 0, l = cases.length; i < l; i++) {
        var detail = $('<li>')
          .text(cases[i])
          .addClass(failed[cases[i]] ? 'failed' : '')
          .appendTo(casesUl);

        if (failed[cases[i]]) {
          if (window.console && console.log) {
            console.log(failed[cases[i]]);
          }

          detail.append($('<span class="error">').text(String(failed[cases[i]])));
        }
      }

      // fire callback
      fn({
          status: ok
        , passed: passed
        , failed: failed
      });
    };

    var cases = keys(suite)
      , i = 0;

    if (!cases.length) {
      return complete();
    }

    currentCase = cases[i];

    test(suite[cases[i]], function check (err) {
      if (err) {
        failed[cases[i]] = err;
      } else {
        passed[cases[i]] = true;
      }

      if (cases[++i]) {
        currentCase = cases[i];
        test(suite[cases[i]], check);
      } else {
        complete();
      }
    });
  });
};

// runs a test
function test (testcase, fn) {
  var timer;

  window.onerror = function (err) {
    complete(err);
  };

  function complete (err) {
    if (complete.run) return;
    if (timer) clearTimeout(timer);
    complete.run = true;
    window.onerror = null;
    fn(err);
  };

  try {
    if (testcase.length > 0) {
      var timer = setTimeout(function () {
        complete(new Error('Timeout'));
      }, 2000);

      testcase(complete);
    } else {
      testcase();
      complete();
    }
  } catch (e) {
    complete(e);
  }
};

// exposes a function to easily create a server for the current test

function create (nsp) {
  if (!testsPorts[currentSuite]) {
    throw new Error('No socket server defined for suite "' + currentSuite + '"');
  }

  if (!testsPorts[currentSuite][currentCase]) {
    throw new Error('No socket server defined for suite "' + currentSuite
      + '" and case "' + currentCase + '"');
  }

  return io.connect(
      document.location.protocol + '//' + document.location.hostname
    + ':' + testsPorts[currentSuite][currentCase] + (nsp || '')
  );
};
