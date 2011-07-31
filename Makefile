
ALL_TESTS = $(shell find test/ -name '*.test.js')

run-tests:
	@./node_modules/.bin/expresso \
		-t 3000 \
		-I support \
		-I lib \
		--serial \
		$(TESTFLAGS) \
		$(TESTS)

test:
	@$(MAKE) TESTS="$(ALL_TESTS)" run-tests

test-cov:
	@TESTFLAGS=--cov $(MAKE) test

test-leaks:
	@ls test/leaks/* | xargs node --expose_debug_as=debug --expose_gc

.PHONY: test
