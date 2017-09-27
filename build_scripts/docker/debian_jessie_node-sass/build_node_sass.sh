#!/bin/bash

mkdir output
docker run -i -t --rm -e ELECTRON_VERSION=1.6.8 -e NODESASS_VERSION=v4.5.3 -v $(pwd)/output:/data:rw node-sass-build-env
