#!/usr/bin/env bash

docker build --build-arg CACHEBUST=$(date +%s)   -t extraterm_twemoji .
docker run -v=$(pwd):/output -e USER_ID=$(id -u) -e GROUP_ID=$(id -g) --rm extraterm_twemoji
