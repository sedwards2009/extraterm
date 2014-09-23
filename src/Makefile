#
#
# Simon Edwards <simon@simonzone.com>

TEST_FILES = flexbuffertest.js

NPM_BIN = npm
TSC_BIN = ./node_modules/.bin/tsc
NODEUNIT_BIN = ./node_modules/.bin/nodeunit
BOWER_BIN = ./node_modules/.bin/bower
RJS_BIN = ./node_modules/.bin/r.js

TS_OUTPUT = build_js

START_COLOR = \033[1;32m
END_COLOR = \033[0m

.PHONEY : unittest watch typescript build init modules install_modules

SOURCES = gui/checkboxmenuitem.ts \
          gui/contextmenu.ts \
          gui/dropdown.ts \
          gui/popup.ts \
          gui/util.ts \
          gui/scrollbar.ts \
          commandframe.ts \
          configure_panel.ts \
          domutils.ts \
          terminal.ts \
          main.ts \
          framewindow.ts \
          windowmessages.ts \
          theme.ts
          
MODULES = immutable \
          qs \
          lodash

build: $(patsubst %.ts,${TS_OUTPUT}/%.js,${SOURCES})
	@echo "$(START_COLOR)Build complete.$(END_COLOR)"

build_js/%.js: %.ts
	${TSC_BIN} --noLib -t ES5 -m amd --outDir ${TS_OUTPUT}/$(dir $<) $<

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
	rm -rf ${TS_OUTPUT}
	mkdir ${TS_OUTPUT}
