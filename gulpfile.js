const gulp = require('gulp');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');
const webpack = require('webpack-stream');
const child = require('child_process');
const help = require('gulp-task-listing');
const eslint = require('gulp-eslint');

gulp.task('help', help);

gulp.task('default', ['build']);

// //////////////////////////////////////
// BUILDING
// //////////////////////////////////////

const BUILD_TARGET_DIR = './dist/';

gulp.task('build', function () {
  return gulp.src('lib/*.js')
    .pipe(webpack({
      config: [
        require('./support/webpack.config.js'),
        require('./support/webpack.config.slim.js')
      ]
    }))
    .pipe(gulp.dest(BUILD_TARGET_DIR));
});

// //////////////////////////////////////
// TESTING
// //////////////////////////////////////

const REPORTER = 'dot';
const TEST_FILE = './test/index.js';
const TEST_SUPPORT_SERVER_FILE = './test/support/server.js';

gulp.task('test', ['lint'], function () {
  if (process.env.hasOwnProperty('BROWSER_NAME')) {
    return testZuul();
  } else {
    return testNode();
  }
});

gulp.task('test-node', testNode);
gulp.task('test-zuul', testZuul);

gulp.task('lint', function () {
  return gulp.src([
    '*.js',
    'lib/**/*.js',
    'test/**/*.js',
    'support/**/*.js'
  ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

// runs zuul through shell process
function testZuul () {
  const ZUUL_CMD = './node_modules/zuul/bin/zuul';
  const args = [
    '--browser-name',
    process.env.BROWSER_NAME,
    '--browser-version',
    process.env.BROWSER_VERSION
  ];
  if (process.env.hasOwnProperty('BROWSER_PLATFORM')) {
    args.push('--browser-platform');
    args.push(process.env.BROWSER_PLATFORM);
  }
  args.push(TEST_FILE);
  const zuulChild = child.spawn(ZUUL_CMD, args, { stdio: 'inherit' });
  zuulChild.on('exit', function (code) { process.exit(code); });
  return zuulChild;
}

function testNode () {
  const MOCHA_OPTS = {
    reporter: REPORTER,
    require: [TEST_SUPPORT_SERVER_FILE],
    bail: true
  };
  return gulp.src(TEST_FILE, { read: false })
    .pipe(mocha(MOCHA_OPTS))
    // following lines to fix gulp-mocha not terminating (see gulp-mocha webpage)
    .once('error', function (err) {
      console.error(err.stack);
      process.exit(1);
    })
    .once('end', function () {
      process.exit();
    });
}

gulp.task('istanbul-pre-test', function () {
  return gulp.src(['lib/**/*.js'])
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

gulp.task('test-cov', ['istanbul-pre-test'], function () {
  gulp.src(['test/*.js', 'test/support/*.js'])
    .pipe(mocha({
      reporter: REPORTER
    }))
    .pipe(istanbul.writeReports())
    .once('error', function (err) {
      console.error(err);
      process.exit(1);
    })
    .once('end', function () {
      process.exit();
    });
});
