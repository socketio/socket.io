#!/bin/bash

cp ./support/package.esm.json ./build/esm/package.json

cp -r ./build/esm/ ./build/esm-debug/

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -e '/debug(/d' ./build/esm/*.js
else
    sed -i -e '/debug(/d' ./build/esm/*.js
fi
