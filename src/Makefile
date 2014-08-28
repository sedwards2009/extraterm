#
#
# Simon Edwards <simon@simonzone.com>

TEST_FILES = flexbuffertest.js

NPM_BIN = npm
TSC_BIN = ./node_modules/.bin/tsc
NODEUNIT_BIN = ./node_modules/.bin/nodeunit
BOWER_BIN = ./node_modules/.bin/bower

TS_OUTPUT = build_js

START_COLOR = \033[1;32m
END_COLOR = \033[0m

.PHONEY : unittest watch typescript build init

SOURCES = gui/checkboxmenuitem.ts \
          gui/contextmenu.ts \
          gui/dropdown.ts \
          gui/popup.ts \
          gui/util.ts \
          commandframe.ts \
          configure_panel.ts \
          domutils.ts \
          terminal.ts \
          main.ts \
          theme.ts

build: $(patsubst %.ts,${TS_OUTPUT}/%.js,${SOURCES})
	@echo "$(START_COLOR)Build complete.$(END_COLOR)"

build_js/%.js: %.ts
	${TSC_BIN} --noLib -m amd --outDir ${TS_OUTPUT}/$(dir $<) $<

unittest:
	@for file in $(TEST_FILES); do \
		${NODEUNIT_BIN} $$file ; \
	done

init:
	@echo "Setting up modules"
	${NPM_BIN} install
	${BOWER_BIN} install
	@echo
	@echo "Done"
	
watch:
	@echo "Watching for changes."
	@echo ${SOURCES} | sed 's/ /\n/g' | entr -r make

clean:
	rm -rf ${TS_OUTPUT}
	mkdir ${TS_OUTPUT}
