
TESTS = $(shell find test -type f ! -name 'common.js')
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--require $(shell pwd)/test/common \
		--reporter $(REPORTER) \
		--growl \
		$(TESTS)

build:
	@./node_modules/.bin/browserbuild -g eio -f engine.js -m engine.io-client lib/

.PHONY: test
