
ALL_TESTS = $(shell find test/ -name '*.test.js')

run-tests:
	expresso \
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
