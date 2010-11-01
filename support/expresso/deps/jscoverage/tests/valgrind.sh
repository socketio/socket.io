#!/bin/sh

rm -f VALGRIND.*
export VALGRIND='valgrind --log-file=VALGRIND.%p'
make check
grep --color=always 'ERROR SUMMARY:' VALGRIND.*
grep --color=always 'definitely lost:' VALGRIND.*
