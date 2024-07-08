#!/usr/bin/env bash

cp ./support/package.cjs.json ./build/cjs/package.json
cp ./support/package.esm.json ./build/esm/package.json

cp -r ./build/esm/ ./build/esm-debug/

if [ "${OSTYPE:0:6}" = darwin ]; then
  sed -i '' -e '/debug(/d' ./build/esm/*.js ./build/esm/**/*.js
else
  sed -i -e '/debug(/d' ./build/esm/*.js ./build/esm/**/*.js
fi
