
help: ## print this message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## update the browser builds
	@./node_modules/.bin/gulp build

test: ## run tests either in the browser or in Node.js, based on the `BROWSERS` variable
	@./node_modules/.bin/gulp test

test-node: ## run tests in Node.js
	@./node_modules/.bin/gulp test-node

test-zuul: ## run tests in the browser
	@./node_modules/.bin/gulp test-zuul

test-cov: ## run tests with coverage in Node.js
	@./node_modules/.bin/gulp test-cov

.PHONY: help test test-node test-zuul test-cov
