
TESTS = test/*.js
BENCHMARKS = $(shell find bench -type f ! -name 'runner.js')
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--require should \
		--require $(shell pwd)/test/common \
		--reporter $(REPORTER) \
		--growl \
		$(TESTS)

bench:
	@node $(PROFILEFLAGS) bench/runner.js $(BENCHMARKS)

.PHONY: test bench
