FROM debian:jessie

RUN apt-get update && apt-get install -y --no-install-recommends g++ curl make ca-certificates git python

ENV NODE_VERSION 12.1.8
RUN cd /root && curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
    && tar zxvf node-v$NODE_VERSION-linux-x64.tar.gz -C /usr/local --strip-components=1

WORKDIR /data
VOLUME /data
CMD cd /tmp \
    && git clone --recursive https://github.com/sass/node-sass.git \
    && cd node-sass \
    && sh -c "git checkout $NODESASS_VERSION" \
    && git submodule update --init --recursive \
    && npm install \
    && sh -c "./node_modules/node-gyp/bin/node-gyp.js rebuild --target=$ELECTRON_VERSION --arch=x64 --dist-url=https://atom.io/download/atom-shell --verbose --libsass_ext= --libsass_cflags= --libsass_ldflags= --libsass_library=" \
    && cp build/Release/binding.node /data \
    && echo "--------------- DONE ------------------"
