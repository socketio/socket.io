#!/bin/bash
openssl req -new -x509 -nodes -batch \
  -out cert.pem \
  -keyout key.pem \
  -newkey rsa:2048 \
  -subj "/CN=localhost" \
  -days 365 \
  >/dev/null 2>&1
