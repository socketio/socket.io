#!/bin/bash
echo -n interp:' '
for i in 1 2 3 4 5; do
  INTERP=`Darwin_OPT.OBJ/js -e 'var d = Date.now(); load("'$1'"); print(Date.now() - d);'`
  echo -n $INTERP' '
done
echo -ne '\njit: '
for i in 1 2 3 4 5; do
  JIT=`Darwin_OPT.OBJ/js -j -e 'var d = Date.now(); load("'$1'"); print(Date.now() - d);'`
  echo -n $JIT' '
done
echo -ne '\njit factor: '
(echo scale=2; echo $INTERP / $JIT ) | bc
