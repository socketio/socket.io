var gulp = require("gulp");
var mocha = require("gulp-mocha");
var istanbul = require("gulp-istanbul");
var browserify = require("./support/browserify.js");
var file = require("gulp-file");
var babel = require("gulp-babel");
var spawn = require("child_process").spawn;
var webpack = require('webpack-stream');


////////////////////////////////////////
// BUILDING
////////////////////////////////////////

var BUILD_TARGET_FILENAME = "engine.io.js";
var BUILD_TARGET_DIR = "./";
var WATCH_GLOBS = [
    "lib/*.js",
    "lib/transports/*.js",
    "package.json"
];

gulp.task("default", ["build"]);

// "gulp watch" from terminal to automatically rebuild when
// files denoted in WATCH_GLOBS have changed.
gulp.task("watch", function(){
    gulp.watch(WATCH_GLOBS, ["build"]);
});

// By default, individual js files are transformed by babel and exported to/dist
gulp.task("babel", function () {
    return gulp.src(["lib/*.js","lib/transports/*.js"], { base: 'lib' })
        .pipe(babel())
        .pipe(gulp.dest("dist"));
});

gulp.task("build-webpack", function() {
    return gulp.src(["lib/*.js","lib/transports/*.js"], { base: 'lib' })
        .pipe(webpack({
            output: {
                filename: "engine.io.js"
            }
        }))
        .pipe(babel({
            compact: false
        }))
        .pipe(gulp.dest("./"));
});

// generate engine.io.js using browserify
gulp.task("build", function(){
    browserify(function(err, output){
        if (err) throw err;
        // TODO: use stream instead of buffering
        file(BUILD_TARGET_FILENAME, output, { src: true })
            .pipe(gulp.dest(BUILD_TARGET_DIR));
    });
});

////////////////////////////////////////
// TESTING
////////////////////////////////////////

var REPORTER = "dot";
var TEST_FILE = "./test/index.js";
var TEST_SUPPORT_SERVER_FILE = "./test/support/server.js";

gulp.task("test", function(){
    if (process.env.hasOwnProperty("BROWSER_NAME")) {
        testZuul();
    } else {
        testNode();
    }
});

gulp.task("test-node", testNode);

gulp.task("test-zuul", testZuul);

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

function testNode() {
    var MOCHA_OPTS = {
        reporter: REPORTER,
        require: [TEST_SUPPORT_SERVER_FILE]
    };
    gulp.src(TEST_FILE, { read: false })
        .pipe(mocha(MOCHA_OPTS))
        // following lines to fix gulp-mocha not terminating (see gulp-mocha webpage)
        .once("error", function(){ process.exit(1); })
        .once("end", function(){ process.exit(); });
}

// runs zuul through shell process
function testZuul() {
    /*
    if (!(process.env.hasOwnProperty("BROWSER_NAME")
        && process.env.hasOwnProperty("BROWSER_VERSION"))) {
        throw "travis env vars for zuul/saucelabs not accessible from " +
        "process.env  (BROWSER_NAME or BROWSER_VERSION)";
    }
*/
    var ZUUL_CMD = "./node_modules/zuul/bin/zuul";
    var args = [
        "--browser-name",
        process.env.BROWSER_NAME,
        "--browser-version",
        process.env.BROWSER_VERSION
    ];
    // add browser platform argument if valid
    if (process.env.hasOwnProperty("BROWSER_PLATFORM")) {
        args.push("--browser-platform");
        args.push(process.env.BROWSER_PLATFORM);
    }

    var zuulChild = spawn(ZUUL_CMD, args, { stdio: "inherit" });
    zuulChild.stdout.on("data", function(data){ console.log(data); });
    zuulChild.stderr.on("data", function(data){ console.log(data); });
}
