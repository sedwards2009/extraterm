/**
 * Assemble svg images into a TTF.
 *
 * This should be run via npm script.
 *  
 * Output is to extraicons.ttf. The first code point in the font is U+EA01.
 */

const webfont = require('webfont').default;
const fs = require('fs');

function main() {
  webfont({
    files: [
      'src/extra_icons/maximize.svg',
      'src/extra_icons/minimize.svg',
      'src/extra_icons/osx_close.svg',
      'src/extra_icons/osx_maximize.svg',
      'src/extra_icons/osx_minimize.svg'
    ],
    fontName: 'extraicons'
  })
  .then((result) => {
      console.log("Done!");
      console.log(result);

      fs.writeFileSync("src/extra_icons/extraicons.ttf", result.ttf);
  },  (ex) => { // Exception reporting.
      console.log(ex);
  });
}

main();
