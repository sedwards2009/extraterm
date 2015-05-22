#
#
# Simon Edwards <simon@simonzone.com>

TEST_FILES = flexbuffertest.js

NPM_BIN = npm
TSC_BIN = ./src/node_modules/.bin/tsc
NODEUNIT_BIN = ./src/node_modules/.bin/nodeunit
BOWER_BIN = ./src/node_modules/.bin/bower
RJS_BIN = ./src/node_modules/.bin/r.js
ELECTRON_BIN = ./src/node_modules/electron-prebuilt/dist/electron

TS_SOURCES := $(shell ls **/*.ts)
TS_JS := $(TS_SOURCES:.ts=.js)
TS_MAP := $(TS_SOURCES:.ts=.js.map)

TS_OUTPUT = build_js

START_COLOR = \033[1;32m
END_COLOR = \033[0m

.PHONEY : build unittest watch typescript build init modules install_modules run
          
MODULES = immutable \
          qs \
          lodash

build:
	@echo "$(START_COLOR)Building...$(END_COLOR)"
	${TSC_BIN}
	@echo "$(START_COLOR)Build complete.$(END_COLOR)"

unittest:
	@for file in $(TEST_FILES); do \
		${NODEUNIT_BIN} $$file ; \
	done

install_modules:
	@echo "Downloading and installing modules"
	${NPM_BIN} install
	${BOWER_BIN} install
	@echo
	@echo "Done installing modules"
	
modules:
	@echo "Converting modules to AMD format"
	@for file in $(MODULES); do \
		echo "    $$file..." ; \
		${RJS_BIN} -convert node_modules/$$file build_modules/$$file ; \
	done
	@echo "Done converting modules"

init: install_modules modules
	@echo "init done"
	
watch:
	@echo "Watching for changes."
	@echo ${SOURCES} | sed 's/ /\n/g' | entr -r make

clean:
	@echo ${TS_JS}
	@echo ${TS_MAP}

run:
	${ELECTRON_BIN} src/
