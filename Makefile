
REPORTER = dot

build: engine.io.js

engine.io.js: lib/*.js lib/transports/*.js package.json
	@./support/browserify.sh > engine.io.js

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/index.js
	@./node_modules/.bin/zuul -- test/index.js

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

.PHONY: test build
