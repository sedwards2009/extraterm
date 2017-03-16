Docker file and script for a Debian Jessie/stable based build environment and scripting for building the node-sass native node module for Linux x64.

Building the Docker image
-------------------------
In this directory run: `docker build -t node-sass-build-env .`

Building a node-sass binary node module
---------------------------------------
* Make sure there is no `output` directory.
* Run `./build_node_sass.sh`
