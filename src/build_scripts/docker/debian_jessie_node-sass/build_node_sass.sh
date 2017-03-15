#!/bin/bash

mkdir output
docker run -i -t --rm -e ELECTRON_VERSION=1.3.4 -e NODESASS_VERSION=v4.1.0 -v $(pwd)/output:/data:rw node-sass-build-env
