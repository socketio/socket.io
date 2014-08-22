
REPORTER = dot

build: engine.io.js

engine.io.js: lib/*.js lib/transports/*.js package.json
	@./support/browserify.sh > engine.io.js

test:
	if [ "x$(BROWSER)" = "x" ]; then make test-node; else make test-zuul; fi

test-node:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/index.js

test-zuul:
	echo "ui: mocha-bdd\nserver: ./test/support/server.js\nbrowsers:\n  - name: `echo $(BROWSER) | awk '{print $$1}'`\n    version: `echo $(BROWSER) | awk '{print $$2}'`" | tee .zuul.yml && ./node_modules/.bin/zuul -- test/index.js

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

.PHONY: test build
