var gulp = require('gulp');
var mocha = require('gulp-mocha');
var babel = require("gulp-babel");
var istanbul = require('gulp-istanbul');
var help = require('gulp-task-listing');

gulp.task('help', help);

gulp.task('default', ['transpile']);

const TRANSPILE_DEST_DIR = './dist';

// By default, individual js files are transformed by babel and exported to /dist
gulp.task('transpile', function () {
  return gulp.src("lib/*.js")
    .pipe(babel({ "presets": ["es2015"] }))
    .pipe(gulp.dest(TRANSPILE_DEST_DIR));
});

gulp.task('test', function(){
  return gulp.src('test/*.js', {read: false})
    .pipe(mocha({
      timeout: 2000,
      reporter: 'dot',
      bail: true
    }))
    .once('error', function () {
      process.exit(1);
    })
    .once('end', function () {
      process.exit();
    });
});

gulp.task('istanbul-pre-test', function () {
  return gulp.src(['lib/**/*.js'])
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

gulp.task('test-cov', ['istanbul-pre-test'], function(){
  return gulp.src(['test/socket.io.js'])
    .pipe(mocha({
      reporter: 'dot'
    }))
    .pipe(istanbul.writeReports())
    .once('error', function (){
      process.exit(1);
    })
    .once('end', function (){
      process.exit();
    });
});
