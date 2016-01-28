var gulp = require('gulp');
var mocha = require('gulp-mocha');
var file = require('gulp-file');
var istanbul = require('gulp-istanbul');
var babel = require("gulp-babel");
var webpack = require('webpack-stream');

// var browserify = require('./support/browserify.js');

gulp.task('webpack', function() {
  return gulp.src('lib/*.js')
    .pipe(webpack({
      entry: './lib/index.js',
      output: {
        filename: 'socket.io.js',
      },
    }))
    .pipe(gulp.dest('./'));
});

// By default, individual js files are transformed by babel and exported to /dist
gulp.task("babel", function () {
  return gulp.src("lib/*.js")
    .pipe(babel())
    .pipe(gulp.dest("dist"));
});

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

