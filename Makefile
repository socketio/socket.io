
REPORTER = dot

test:
	@if [ "x$(BROWSERS)" = "x" ]; then make test-node; else make test-zuul; fi

test-node:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail \
		test/index.js

test-zuul:
	@./node_modules/zuul/bin/zuul \
		test/index.js

.PHONY: test
