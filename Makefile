
REPORTER = dot

build: engine.io.js

engine.io.js: lib/*.js lib/transports/*.js package.json
	@./support/browserify.sh > engine.io.js

test:
	@if [ "x$(BROWSER_NAME)" = "x" ]; then make test-node; else make test-zuul; fi

test-node:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/index.js

test-zuul:
	@if [ "x$(BROWSER_PLATFORM)" = "x" ]; then \
		./node_modules/zuul/bin/zuul \
		--browser-name $(BROWSER_NAME) \
		--browser-version $(BROWSER_VERSION) \
		test/index.js; \
		else \
		./node_modules/zuul/bin/zuul \
		--browser-name $(BROWSER_NAME) \
		--browser-version $(BROWSER_VERSION) \
		--browser-platform "$(BROWSER_PLATFORM)" \
		test/index.js; \
	fi

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

.PHONY: test build
