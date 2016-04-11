
build: engine.io.js

engine.io.js:
	@./node_modules/.bin/gulp build

test:
	@./node_modules/.bin/gulp test

test-node:
	@./node_modules/.bin/gulp test-node

test-zuul:
	@./node_modules/.bin/gulp test-zuul

test-cov:
	@./node_modules/.bin/gulp test-cov

.PHONY: test build
