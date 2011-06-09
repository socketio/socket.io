build:
	./bin/build

builder:
	node ./bin/builder.js

test:
	expresso -I lib test/builder.node.js

.PHONY: test builder