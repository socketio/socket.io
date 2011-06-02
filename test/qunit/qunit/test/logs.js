// TODO disable reordering for this suite!


var begin = 0,
	moduleStart = 0,
	moduleDone = 0,
	testStart = 0,
	testDone = 0,
	log = 0,
	moduleContext,
	moduleDoneContext,
	testContext,
	testDoneContext,
	logContext;

QUnit.begin = function() {
	begin++;
};
QUnit.done = function() {
};
QUnit.moduleStart = function(context) {
	moduleStart++;
	moduleContext = context;
};
QUnit.moduleDone = function(context) {
	moduleDone++;
	moduleDoneContext = context;
};
QUnit.testStart = function(context) {
	testStart++;
	testContext = context;
};
QUnit.testDone = function(context) {
	testDone++;
	testDoneContext = context;
};
QUnit.log = function(context) {
	log++;
	logContext = context;
};

var logs = ["begin", "testStart", "testDone", "log", "moduleStart", "moduleDone", "done"];
for (var i = 0; i < logs.length; i++) {
	(function() {
		var log = logs[i],
			logger = QUnit[log];
		QUnit[log] = function() {
			console.log(log, arguments);
			logger.apply(this, arguments);
		};
	})();
}

module("logs1");

test("test1", 13, function() {
	equal(begin, 1);
	equal(moduleStart, 1);
	equal(testStart, 1);
	equal(testDone, 0);
	equal(moduleDone, 0);

	deepEqual(logContext, {
		result: true,
		message: undefined,
		actual: 0,
		expected: 0
	});
	equal("foo", "foo", "msg");
	deepEqual(logContext, {
		result: true,
		message: "msg",
		actual: "foo",
		expected: "foo"
	});
	strictEqual(testDoneContext, undefined);
	deepEqual(testContext, {
		name: "test1"
	});
	strictEqual(moduleDoneContext, undefined);
	deepEqual(moduleContext, {
		name: "logs1"
	});

	equal(log, 12);
});
test("test2", 10, function() {
	equal(begin, 1);
	equal(moduleStart, 1);
	equal(testStart, 2);
	equal(testDone, 1);
	equal(moduleDone, 0);

	deepEqual(testDoneContext, {
		name: "test1",
		failed: 0,
		passed: 13,
		total: 13
	});
	deepEqual(testContext, {
		name: "test2"
	});
	strictEqual(moduleDoneContext, undefined);
	deepEqual(moduleContext, {
		name: "logs1"
	});

	equal(log, 22);
});

module("logs2");
	
test("test1", 9, function() {
	equal(begin, 1);
	equal(moduleStart, 2);
	equal(testStart, 3);
	equal(testDone, 2);
	equal(moduleDone, 1);

	deepEqual(testContext, {
		name: "test1"
	});
	deepEqual(moduleDoneContext, {
		name: "logs1",
		failed: 0,
		passed: 23,
		total: 23
	});
	deepEqual(moduleContext, {
		name: "logs2"
	});

	equal(log, 31);
});
test("test2", 8, function() {
	equal(begin, 1);
	equal(moduleStart, 2);
	equal(testStart, 4);
	equal(testDone, 3);
	equal(moduleDone, 1);

	deepEqual(testContext, {
		name: "test2"
	});
	deepEqual(moduleContext, {
		name: "logs2"
	});

	equal(log, 39);
});
