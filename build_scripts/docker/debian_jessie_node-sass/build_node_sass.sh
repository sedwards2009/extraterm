#!/bin/bash

mkdir output
docker run -i -t --rm -e ELECTRON_VERSION=5.0.6 -e NODESASS_VERSION=v4.12.0 -v $(pwd)/output:/data:rw node-sass-build-env
