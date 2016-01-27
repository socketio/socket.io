(function(){

    var gulp = require("gulp");
    var mocha = require("gulp-mocha");
    var browserify = require("./support/browserify.js");
    var file = require("gulp-file");

    // Task names
    var TASK_WATCHER = "watch";
    var TASK_BUILD = "build";
    var TASK_TEST = "test";
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

    gulp.task(TASK_TEST, function(){

    });

})();