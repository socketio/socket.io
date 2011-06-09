
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

build:
	./bin/build

builder:
	node ./bin/builder.js

.PHONY: test
