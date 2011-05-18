# This makefile exists to help run tests.
#
# If TEST_UNIX is a non-empty value, runs tests for UNIX sockets. This
# functionality is not in node-websocket-server at the moment.

.PHONY: test

all: test test-unix

test:
	for f in `ls -1 test/test-*.js | grep -v unix` ; do \
		echo $$f ; \
		node $$f ; \
	done

test-unix:
	if [[ -n "$$TEST_UNIX" ]] ; then \
		for f in `ls -1 test/test-*.js | grep unix` ; do \
			echo $$f ; \
			node $$f ; \
		done \
	fi
