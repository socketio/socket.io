
TESTS = $(shell find test/*.js -depth 1 -type f ! -name 'common.js')
REPORTER = dot

build: components lib
	@component build --standalone eio
	@mv build/build.js engine.io.js
	@rm -rf build

components: component.json
	@component install --dev

clean:
	rm -fr components

test:
	@./node_modules/.bin/mocha \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

test-cov:
	@./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

test-browser:
	@./node_modules/.bin/serve test/

.PHONY: test test-browser clean
