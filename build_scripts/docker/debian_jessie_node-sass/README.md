This is a Docker file and script for a Debian Jessie/stable based build environment and scripting for building the node-sass native node module for Linux x64. This older Linux distribution is used for building because it has an older glibc to compile against. This will allow the binary to work on older Linux systems as well as more modern ones.

Note: The dockerfile and build script contain version numbers which you may want to revise.

Building the Docker image
-------------------------
In this directory run: `docker build -t node-sass-build-env .`

Building a node-sass binary node module
---------------------------------------
* Make sure there is no `output` directory.
* Run `./build_node_sass.sh`
