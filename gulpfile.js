var gulp = require('gulp');
var mocha = require('gulp-mocha');
var file = require('gulp-file');
var istanbul = require('gulp-istanbul');

var browserify = require('./support/browserify.js');


gulp.task('build', function(){
  browserify(function(err, out){
    if(err){
      throw err;
    }else{
      gulp.src('')
        .pipe(file('socket.io.js', out))
        .pipe(gulp.dest('./'));
    }
  });
});

gulp.task('test-node', function(){
  gulp.src(['test/*.js', 'test/support/*.js'])
    .pipe(mocha({
      reporter: 'dot'
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
  gulp.src(['test/*.js', 'test/support/*.js'])
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

