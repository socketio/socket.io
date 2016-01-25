var gulp = require('gulp');
var mocha = require('gulp-mocha');

gulp.task('test', function(){
  return gulp.src('test/*.js', {read: false})
    .pipe(mocha({
      timeout: 2000,
      reporter: 'dot',
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