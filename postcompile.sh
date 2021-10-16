#!/bin/bash

cp ./support/package.cjs.json ./build/cjs/package.json
cp ./support/package.esm.json ./build/esm/package.json

cp -r ./build/esm/ ./build/esm-debug/

sed -i '/debug(/d' ./build/esm/*.js

# for backward compatibility with `const socket = require("socket.io-client")(...)`
echo -e '\nmodule.exports = lookup;' >> ./build/cjs/index.js
