
ALL_TESTS = $(shell find test/ -name '*.test.js')

run-tests:
	@npm link > /dev/null
	@./node_modules/.bin/expresso \
		-I lib \
		-I support \
		--serial \
		$(TESTS)

test:
	@$(MAKE) TESTS="$(ALL_TESTS)" run-tests

test-acceptance:
	@node support/test-runner/app

build:
	./bin/build

.PHONY: test
