
REPORTER = dot

build: components lib
	@component build --standalone eio
	@mv build/build.js build.js
	@rm -rf build
	@./node_modules/.bin/uglifyjs < build.js > socket.io-client.js

components: component.json
	@component install --dev

clean:
	rm -fr components

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

.PHONY: test clean
