
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/index.js
	@./node_modules/.bin/zuul -- test/index.js

.PHONY: test
