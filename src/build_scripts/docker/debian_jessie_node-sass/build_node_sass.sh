#!/bin/bash

mkdir output
docker run -i -t --rm -e ELECTRON_VERSION=1.6.6 -e NODESASS_VERSION=v4.1.0 -v $(pwd)/output:/data:rw node-sass-build-env
