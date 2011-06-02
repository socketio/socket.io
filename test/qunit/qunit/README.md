[QUnit](http://docs.jquery.com/QUnit) - A JavaScript Unit Testing framework.
================================

QUnit is a powerful, easy-to-use, JavaScript test suite. It's used by the jQuery
project to test its code and plugins but is capable of testing any generic
JavaScript code (and even capable of testing JavaScript code on the server-side).

QUnit is especially useful for regression testing: Whenever a bug is reported,
write a test that asserts the existence of that particular bug. Then fix it and
commit both. Every time you work on the code again, run the tests. If the bug
comes up again - a regression - you'll spot it immediately and know how to fix
it, because you know what code you just changed.

Having good unit test coverage makes safe refactoring easy and cheap. You can
run the tests after each small refactoring step and always know what change
broke something.

QUnit is similar to other unit testing frameworks like JUnit, but makes use of
the features JavaScript provides and helps with testing code in the browser, eg.
with it's stop/start facilities for testing asynchronous code.

If you are interested in helping developing QUnit, you are in the right place.
For related discussions, visit the
[QUnit and Testing forum](http://forum.jquery.com/qunit-and-testing).
