var gulp = require('gulp');
var mocha = require('gulp-mocha');
var babel = require("gulp-babel");

// By default, individual js files are transformed by babel and exported to /dist
gulp.task("default", function () {
  return gulp.src("lib/*.js")
    .pipe(babel())
    .pipe(gulp.dest("dist"));
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
