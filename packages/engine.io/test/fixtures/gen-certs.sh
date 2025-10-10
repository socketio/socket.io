#!/bin/sh

openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -sha256 -key ca.key -out ca.crt -days 3650 \
  -subj "/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd"

openssl genrsa -out server.key 4096
openssl req -x509 -new -nodes -sha256 -key server.key -out server.crt -CA ca.crt -CAkey ca.key -days 3650 \
  -subj "/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=localhost"

openssl genrsa -out client.key 4096
openssl req -x509 -new -nodes -sha256 -key client.key -out client.crt -CA ca.crt -CAkey ca.key -days 3650 \
  -subj "/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=Foo client"

openssl pkcs12 -export -out client.pfx -inkey client.key -in client.crt -certfile ca.crt -passout "pass:"
