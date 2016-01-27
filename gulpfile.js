(function(){

    var gulp = require("gulp");
    var mocha = require("gulp-mocha");
    var browserify = require("./support/browserify.js");
    var file = require("gulp-file");
    var spawn = require("child-process").spawn;

    // Task names
    var TASK_BUILD = "build"; // rebuild
    var TASK_WATCHER = "watch"; // auto rebuild on changes
    var TASK_TEST = "test"; // multiplexes to test-node / test-zuul
    var TASK_TEST_NODE = "test-node";
    var TASK_TEST_ZUUL = "test-zuul";
    var TASK_TEST_COV = "test-cov";


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

    gulp.task("default", [TASK_BUILD]);

    // "gulp watch" from terminal to automatically rebuild when
    // files denoted in WATCH_GLOBS have changed.
    gulp.task(TASK_WATCHER, function(){
        gulp.watch(WATCH_GLOBS, [TASK_BUILD]);
    });

    // generate engine.io.js using browserify
    gulp.task(TASK_BUILD, function(){
        browserify(function(err, output){
            if (err) throw err;
            // TODO: use browserify/webpack as stream
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

    gulp.task(TASK_TEST, function(){
        if (process.env.hasOwnProperty("BROWSER_NAME")) {
            testZuul();
        } else {
            testNode();
        }
    });

    gulp.task(TASK_TEST_NODE, testNode);

    gulp.task(TASK_TEST_ZUUL, testZuul);

    gulp.task(TASK_TEST_COV, function(){
        //TODO
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

    function testZuul() {

        if (!(process.env.hasOwnProperty("BROWSER_NAME")
            && process.env.hasOwnProperty("BROWSER_VERSION"))) {
            throw "travis env vars for zuul/saucelabs not accessible from " +
            "process.env  (BROWSER_NAME or BROWSER_VERSION)";
        }

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

        spawn(ZUUL_CMD, args, { stdio: "inherit" });
    }

})();