var gulp = require('gulp');
var mocha = require('gulp-mocha');
var babel = require("gulp-babel");

var TESTS = 'test/*.js';
var REPORTER = 'dot';

gulp.task("default", ["transpile"]);

gulp.task('test', function(){
    return gulp.src(TESTS, {read: false})
    .pipe(mocha({
      slow: 500,
      reporter: REPORTER,
      bail: true
    }))
    .once('error', function(){
      process.exit(1);
    })
    .once('end', function(){
      process.exit();
    });
});

// By default, individual js files are transformed by babel and exported to /dist
gulp.task("transpile", function(){
    return gulp.src(["lib/*.js","lib/transports/*.js"], { base: 'lib' })
        .pipe(babel({ "presets": ["es2015"] }))
        .pipe(gulp.dest("dist"));
});
