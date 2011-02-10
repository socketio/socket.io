test:
	./support/expresso/bin/expresso -I lib $(TESTFLAGS) tests/*.js

test-cov:
	@TESTFLAGS=--cov $(MAKE) test
	
example:
	node ./example/server.js

example-ssl:
	node ./example/server-ssl.js

.PHONY: example
