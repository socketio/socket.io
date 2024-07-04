#!/bin/bash

cp ./support/package.esm.json ./build/esm/package.json

cp -r ./build/esm/ ./build/esm-debug/

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -e '/debug(/d' ./build/esm/*.js
else
    sed -i -e '/debug(/d' ./build/esm/*.js
fi

# for backward compatibility with `const socket = require("socket.io-client")(...)`
echo -e '\nmodule.exports = lookup;' >> ./build/cjs/index.js
