
ALL_TESTS = $(shell find test/ -name '*.test.js')

run-tests:
	@./support/expresso/bin/expresso \
		-I support/should.js/lib \
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
