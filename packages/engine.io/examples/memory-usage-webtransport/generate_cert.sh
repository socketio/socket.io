#!/bin/bash
openssl req -new -x509 -nodes \
    -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
    -days 14 \
    -out cert.pem -keyout key.pem \
    -subj '/CN=127.0.0.1'
