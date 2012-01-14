
TESTS = test/*.js
BENCHMARKS = $(shell find bench -type f ! -name 'runner.js')
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--require $(shell pwd)/test/common \
		--reporter $(REPORTER) \
		--slow 100ms \
		--bail \
		--growl \
		$(TESTS)

bench:
	@node $(PROFILEFLAGS) bench/runner.js $(BENCHMARKS)

.PHONY: test bench
