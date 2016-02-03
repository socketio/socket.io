const gulp = require("gulp");
const mocha = require("gulp-mocha");
const istanbul = require("gulp-istanbul");
const browserify = require("./support/browserify.js");
const file = require("gulp-file");
const webpack = require('webpack-stream');
const child = require("child_process");
const help = require("gulp-task-listing");


gulp.task("help", help);

////////////////////////////////////////
// BUILDING
////////////////////////////////////////

const BUILD_TARGET_FILENAME = "engine.io.js";
const BUILD_TARGET_DIR = "./";
const WATCH_GLOBS = [
  "lib/*.js",
  "lib/transports/*.js",
  "package.json"
];

gulp.task("default", ["build"]);

gulp.task("build", ["webpack"]);


gulp.task("webpack", function() {
  return gulp.src(["lib/*.js", "lib/transports/*.js"], {
      base: 'lib'
    })
    .pipe(webpack({
      output: {
        filename: BUILD_TARGET_FILENAME,
        library: "eio",
        libraryTarget: "umd"
      },
      externals: {
        'global': glob()
      },
      module: {
        loaders: [{
          test: /\.(js|jsx)?$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel', // 'babel-loader' is also a legal name to reference 
          query: {
            presets: ['react', 'es2015']
          }
        }]
      }
    }))
    .pipe(gulp.dest(BUILD_TARGET_DIR));
});

// generate engine.io.js using browserify
gulp.task("browserify", function() {
  return browserify(function(err, output) {
    if (err) throw err;
    // TODO: use stream instead of buffering
    file(BUILD_TARGET_FILENAME, output, {
        src: true
      })
      .pipe(gulp.dest(BUILD_TARGET_DIR));
  });
});

// "gulp watch" from terminal to automatically rebuild when
// files denoted in WATCH_GLOBS have changed.
gulp.task("watch", function() {
  return gulp.watch(WATCH_GLOBS, ["build"]);
});

////////////////////////////////////////
// TESTING
////////////////////////////////////////

const REPORTER = "dot";
const TEST_FILE = "./test/index.js";
const TEST_SUPPORT_SERVER_FILE = "./test/support/server.js";

gulp.task("test", function() {
  child.spawnSync("npm", ["install"], { stdio: "inherit" }); // deals with npm 3 flat dependencies bug
  if (process.env.hasOwnProperty("BROWSER_NAME")) {
    return testZuul();
  } else {
    return testNode();
  }
});

gulp.task("test-node", testNode);

gulp.task("test-zuul", testZuul);

gulp.task('istanbul-pre-test', function() {
  return gulp.src(['lib/**/*.js'])
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

gulp.task('test-cov', ['istanbul-pre-test'], function() {
  return gulp.src(['test/*.js', 'test/support/*.js'])
    .pipe(mocha({
      reporter: 'dot',
      bail: true
    }))
    .pipe(istanbul.writeReports())
    .once('error', function(err) {
      console.log(err.stack);
      process.exit(1);
    })
    .once('end', function() {
      process.exit();
    });
});

function testNode() {
  const MOCHA_OPTS = {
    reporter: REPORTER,
    require: [TEST_SUPPORT_SERVER_FILE],
    bail: true
  };
  return gulp.src(TEST_FILE, {
      read: false
    })
    .pipe(mocha(MOCHA_OPTS))
    // following lines to fix gulp-mocha not terminating (see gulp-mocha webpage)
    .once("error", function(err) {
      console.log(err.stack);
      process.exit(1);
    })
    .once("end", function() {
      process.exit();
    });
}

// runs zuul through shell process
function testZuul() {
  const ZUUL_CMD = "./node_modules/zuul/bin/zuul";
  const args = [
    "--browser-name",
    process.env.BROWSER_NAME || "missing",
    "--browser-version",
    process.env.BROWSER_VERSION || "missing"
  ];
  // add browser platform argument if valid
  if (process.env.hasOwnProperty("BROWSER_PLATFORM")) {
    args.push("--browser-platform");
    args.push(process.env.BROWSER_PLATFORM);
  }

  args.push("test/index.js");
  
  return child.spawn(ZUUL_CMD, args, {
    stdio: "inherit"
  });
}

/**
 * Populates `global`.
 *
 * @api private
 */

function glob() {
  return 'typeof self !== "undefined" ? self : ' + 'typeof window !== "undefined" ? window : ' + 'typeof global !== "undefined" ? global : {}';
}
