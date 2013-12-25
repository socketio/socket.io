
REPORTER = dot

build: components lib
	@./node_modules/.bin/component build --standalone io
	@mv build/build.js build.js
	@rm -rf build
	@./node_modules/.bin/uglifyjs < build.js > socket.io-client.js
	@rm -f build.js
	@echo "… done"

components: component.json
	@./node_modules/.bin/component install --dev

clean:
	rm -fr components build build.js

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

.PHONY: test clean
