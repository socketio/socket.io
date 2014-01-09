
REPORTER = dot

build:
	@./node_modules/.bin/browserify --standalone io -o socket.io.js .

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail \
		test/index.js
	@./node_modules/.bin/zuul -- test/index.js

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--reporter $(REPORTER) \
		test/

.PHONY: test
