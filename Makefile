
TESTS = $(shell find test/*.js -depth 1 -type f ! -name 'common.js')
REPORTER = dot

build: components lib
	@component build --dev

build-standalone: components lib
	@component build --standalone eio

components: component.json
	@component install --dev

clean:
	rm -fr build components

test:
	@./node_modules/.bin/mocha \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

test-browser:
	@./node_modules/.bin/serve test/

.PHONY: test test-browser clean
