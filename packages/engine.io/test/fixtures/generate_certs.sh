#!/bin/bash

# Generate CA private key and certificate
openssl genrsa -out ca.key 2048
openssl req -x509 -new -nodes -key ca.key -days 365 -out ca.crt -subj "/CN=Test CA"

# Generate server key and certificate request
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/CN=localhost"

# Generate client key and certificate request
openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr -subj "/CN=client"

# Sign server certificate with CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365

# Sign client certificate with CA
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 365

# Generate client PFX files
openssl pkcs12 -export -passout pass: -out client.pfx -inkey client.key -in client.crt -certfile ca.crt
