
ALL_TESTS = $(shell find test/ -name '*.test.js')

run-tests:
	@./support/expresso/bin/expresso \
		-I support/should.js/lib \
		-I support \
		-I lib \
		--serial \
		$(TESTS)

test:
	@$(MAKE) TESTS="$(ALL_TESTS)" run-tests

.PHONY: test
