
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

build: components lib
	@component build --standalone eio
	@mv build/build.js socket.io-client.js
	@rm -rf build

components: component.json
	@component install --dev

clean:
	rm -fr components

.PHONY: test clean
