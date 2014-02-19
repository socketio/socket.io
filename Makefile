
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

.PHONY: test
