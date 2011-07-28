
ALL_TESTS = $(shell find test/ -name '*.test.js')
TRANSPORT = 'xhr-polling'

run-tests:
	@npm link --local > /dev/null
	@./node_modules/.bin/expresso \
		-I lib \
		-I support \
		--serial \
		$(TESTS)

test:
	@$(MAKE) TESTS="$(ALL_TESTS)" run-tests

test-acceptance:
	@npm link --local > /dev/null
	@node support/test-runner/app $(TRANSPORT)

build:
	@node ./bin/builder.js

.PHONY: test
