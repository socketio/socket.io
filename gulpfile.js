var gulp = require('gulp');
var mocha = require('gulp-mocha');
var file = require('gulp-file');
var istanbul = require('gulp-istanbul');
var babel = require("gulp-babel");
var webpack = require('webpack-stream');
var exec = require('child_process').exec;

var browserify = require('./support/browserify.js');

gulp.task('build-webpack', function() {
  return gulp.src('lib/*.js') 
    .pipe(webpack({
      entry: './lib/index.js',
      output: {
        filename: 'socket.io.js',
      },
    }))
    .pipe(babel({
      compact: false
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

gulp.task('test', [process.env.BROWSER_NAME ? 'test-zuul' : 'test-node'], function(){
});

gulp.task('test-zuul', function(){
  if(process.env.BROWSER_PLATFORM){
    exec('./node_modules/zuul/bin/zuul ' +
        '--browser-name ' + process.env.BROWSER_NAME + ' ' +
        '--browser-version ' + process.env.BROWSER_VERSION + ' ' +
        '--browser-platform ' +process.env.BROWSER_PLATFORM + ' ' +
        'test/index.js',
      function(err, stdout, stderr){
        console.log(stdout);
        console.error(stderr);
    });
  }else{
    exec('./node_modules/zuul/bin/zuul ' +
      '--browser-name ' + process.env.BROWSER_NAME + ' ' +
      '--browser-version ' + process.env.BROWSER_VERSION + ' ' +
      'test/index.js',
      function(err, stdout, stderr){
        console.log(stdout);
        console.error(stderr);
      });
  }
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

