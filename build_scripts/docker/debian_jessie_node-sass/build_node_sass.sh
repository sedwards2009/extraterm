#!/bin/bash

mkdir output
docker run -i -t --rm -e ELECTRON_VERSION=4.0.4 -e NODESASS_VERSION=v4.9.0 -v $(pwd)/output:/data:rw node-sass-build-env
