
TESTS = $(shell find test/*.js -depth 1 -type f ! -name 'common.js')
REPORTER = dot

build:
	@./node_modules/.bin/browserify --standalone eio -o engine.io.js .

test:
	@./node_modules/.bin/mocha \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

test-browser:
	@./node_modules/.bin/serve test/

.PHONY: test test-browser clean
