
TESTS = $(shell find test/*.js -depth 1 -type f ! -name 'common.js')
REPORTER = dot

all: build build-dev

build:
	@./node_modules/.bin/browserbuild \
		-g eio \
		-m engine.io-client -b lib/ \
		lib > dist/engine.io.js

build-dev:
	@./node_modules/.bin/browserbuild \
		-g eio \
		-d -m engine.io-client -b lib/ \
		lib > dist/engine.io-dev.js

test:
	@./node_modules/.bin/mocha \
		--require ./test/common \
		--reporter $(REPORTER) \
		$(TESTS)

test-browser:
	@./node_modules/.bin/serve test/

.PHONY: test
