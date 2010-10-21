test:
	./support/expresso/bin/expresso -I lib $(TESTFLAGS) tests/*.js
	
example:
	node ./example/server.js

.PHONY: example