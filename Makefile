
REPORTER = dot

build: socket.io.js

socket.io.js: lib/*.js package.json
	@./node_modules/.bin/gulp

test:
	@./node_modules/.bin/gulp test

test-node:
	@./node_modules/.bin/gulp test-node

test-zuul:
	@./node_modules/.bin/gulp test-zuul

test-cov:
	@./node_modules/.bin/gulp test-cov

.PHONY: test
