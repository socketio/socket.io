
ALL_TESTS = $(shell find test/ -name '*.test.js')

run-tests:
	@npm link > /dev/null --local
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

.PHONY: test
