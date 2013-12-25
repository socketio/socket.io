
REPORTER = dot

build:
	@./node_modules/.bin/browserify --standalone io -o socket.io.js .

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--reporter $(REPORTER) \
		$(TESTS)

.PHONY: test
