/**
 * Assemble svg images into a TTF.
 *
 * This should be run via npm script.
 *
 * Output is to extraicons.ttf. The first code point in the font is U+EA01.
 *
 * WARNING: Don't forget to do the SVG preparation steps in
 * https://github.com/fontello/fontello/wiki/How-to-use-custom-images#importing-svg-images
 * when adding more icons. Otherwise you will get broken TTF files.
 *
 * TIP: The program `pyftinspect` from `fonttools` is useful for checking
 * the validity of generated ttf files.
 */
const webfont = require('webfont').default;
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = "resources/fonts/extraicons.ttf";
const log = console.log.bind(console);

function main() {
  webfont({
    files: [
      'resources/extra_icons/1_maximize.svg',
      'resources/extra_icons/2_minimize.svg',
      'resources/extra_icons/3_osx_close.svg',
      'resources/extra_icons/4_osx_maximize.svg',
      'resources/extra_icons/5_osx_minimize.svg',
      'resources/extra_icons/6_triangle_down.svg',
      'resources/extra_icons/7_triangle_up.svg',
      'resources/extra_icons/8_rows.svg',
      'resources/extra_icons/9_pocketknife.svg',
    ],
    fontName: 'extraicons',
    fontStyle: 'Regular',
    fontWeight: 'Book',
    formats: ['ttf'],
    svgicons2svgfont: {fontStyle: ""}
  })
  .then((result) => {
    fs.writeFileSync(OUTPUT_PATH, result.ttf);
    log(result);
    log("");
    log(`Wrote TTF to ${path.resolve(OUTPUT_PATH)}`);

  },  (ex) => { // Exception reporting.
    log(ex);
  });
}

main();
