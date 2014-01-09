
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--slow 200ms \
		--bail

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--reporter $(REPORTER) \
		test/

.PHONY: test
