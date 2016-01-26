var gulp = require('gulp');
var mocha = require('gulp-mocha');
var babel = require("gulp-babel");

// By default, individual js files are transformed by babel and exported to /dist
gulp.task("babel", function () {
  return gulp.src(["lib/*.js","lib/transports/*.js"], { base: 'lib' })
    .pipe(babel())
    .pipe(gulp.dest("dist"));
});

var TESTS = 'test/*.js';
var REPORTER = 'dot';

gulp.task('test', function(
    return gulp.src(TESTS, {read: false})
    .pipe(mocha({
      timeout: 2000,
      reporter: REPORTER,
      bail: true,
      globals: ['___eio', 'document']
    }))
    .once('error', function () {
      process.exit(1);
    })
    .once('end', function () {
      process.exit();
    });
});