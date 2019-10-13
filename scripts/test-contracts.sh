#!/bin/sh
set -e

# Build the whole thing
docker-compose build

# Start docker
docker-compose up -d

# Copy the secret manager used for CI
docker-compose exec wildcards sh -c "mv /app/secretsManagerCi.js /app/secretsManager.js"

# Run the tests
docker-compose exec wildcards sh -c "/app/node_modules/.bin/truffle compile"

# Run the tests
docker-compose exec wildcards sh -c "/app/node_modules/.bin/truffle test --network test"

# Stop the container
docker-compose down 
