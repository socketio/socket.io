
BENCHMARKS = $(shell find bench -type f ! -name 'runner.js')

test:
	@./node_modules/.bin/gulp test

test-cov: lib-cov
	EIO_COV=1 $(MAKE) test REPORTER=html-cov > coverage.html

lib-cov:
	jscoverage --no-highlight lib lib-cov

bench:
	@node $(PROFILEFLAGS) bench/runner.js $(BENCHMARKS)

.PHONY: test test-cov bench
