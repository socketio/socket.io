
help: ## print this message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

test: ## run tests either in the browser or in Node.js, based on the `BROWSERS` variable
	@if [ "x$(BROWSERS)" = "x" ]; then make test-node; else make test-zuul; fi

test-node: ## run tests in Node.js
	@./node_modules/.bin/mocha --reporter dot test/index.js

test-zuul: ## run tests in the browser
	@./node_modules/zuul/bin/zuul test/index.js

run-benchmarks: ## run the benchmarks
	node benchmarks/index.js

.PHONY: help test test-node test-zuul
