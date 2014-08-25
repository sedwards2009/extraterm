
TEST_FILES = flexbuffertest.js

TSC_BIN = ./node_modules/.bin/tsc
NODEUNIT_BIN = ./node_modules/nodeunit/bin/nodeunit
TS_OUTPUT = build_js

.PHONEY : unittest watch typescript build

SOURCES = gui/checkboxmenuitem.ts \
          gui/contextmenu.ts \
          gui/dropdown.ts \
          gui/popup.ts \
          gui/util.ts \
          commandframe.ts \
          configure_panel.ts \
          domutils.ts \
          terminal.ts

build: $(patsubst %.ts,${TS_OUTPUT}/%.js,${SOURCES})
	@echo "Build complete."

build_js/%.js: %.ts
	${TSC_BIN} --noLib -m amd --outDir ${TS_OUTPUT}/$(dir $<) $<

unittest:
	@for file in $(TEST_FILES); do \
		${NODEUNIT_BIN} $$file ; \
	done
	
watch:
	@echo "Watching for changes."
	@echo ${SOURCES} | sed 's/ /\n/g' | entr -r make

clean:
	rm ${TS_OUTPUT}/**.js
