(function(){

    var gulp = require("gulp");
    var mocha = require("gulp-mocha");
    var browserify = require("./support/browserify.js");
    var file = require("gulp-file");

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
    var TEST_FILE_GLOB = "test/index.js";

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

    });

    function testNode() {
        var MOCHA_OPTS = {
            reporter: REPORTER,
            require: ["./test/support/server.js"]
        };
        gulp.src(TEST_FILE_GLOB, { read: false })
            .pipe(mocha(MOCHA_OPTS))
            // following lines to fix gulp-mocha not terminating (see gulp-mocha webpage)
            .once("error", function(){ process.exit(1); })
            .once("end", function(){ process.exit(); });
    }

    function testZuul() {

    }

})();