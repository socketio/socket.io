var gulp = require('gulp');
var mocha = require('gulp-mocha');
var file = require('gulp-file');

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

