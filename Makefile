build:
	./bin/build

builder:
	./bin/builder

test:
	expresso -I lib test/builder.node.js

.PHONY: test builder