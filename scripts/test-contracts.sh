#!/bin/sh
set -e

# Build the whole thing
docker-compose build

# Start docker
docker-compose up -d 

# Run the tests
docker-compose run wildcards sh -c "/app/node_modules/.bin/truffle compile"

# Run the tests
docker-compose run wildcards sh -c "/app/node_modules/.bin/truffle test"

# Stop the container
docker-compose down 
