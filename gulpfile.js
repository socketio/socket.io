const gulp = require('gulp');
const mocha = require('gulp-mocha');
const babel = require('gulp-babel');
const nsp = require('gulp-nsp');
const eslint = require('gulp-eslint');

const TESTS = 'test/*.js';
const REPORTER = 'dot';

gulp.task('default', ['transpile']);

gulp.task('test', ['nsp', 'lint'], function () {
  if (parseInt(process.versions.node, 10) < 4 && process.env.EIO_WS_ENGINE !== 'ws') {
    console.info('Node version < 4, skipping tests with uws engine');
    process.exit();
  }
  return gulp.src(TESTS, {read: false})
    .pipe(mocha({
      slow: 500,
      reporter: REPORTER,
      bail: true
    }))
    .once('error', function (err) {
      console.error(err.stack);
      process.exit(1);
    })
    .once('end', function () {
      process.exit();
    });
});

gulp.task('lint', function () {
  return gulp.src([
    '*.js',
    'lib/**/*.js',
    'test/**/*.js'
  ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

// By default, individual js files are transformed by babel and exported to /dist
gulp.task('transpile', function () {
  return gulp.src(['lib/**/*.js'], { base: 'lib' })
        .pipe(babel({ 'presets': ['es2015'] }))
        .pipe(gulp.dest('dist'));
});

gulp.task('nsp', function (cb) {
  nsp({package: __dirname + '/package.json'}, cb);
});
