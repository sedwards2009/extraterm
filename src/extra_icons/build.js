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

function main() {
  webfont({
    files: [
      'src/extra_icons/maximize.svg',
      'src/extra_icons/minimize.svg',
      'src/extra_icons/osx_close.svg',
      'src/extra_icons/osx_maximize.svg',
      'src/extra_icons/osx_minimize.svg',
      'src/extra_icons/triangle_down.svg',
      'src/extra_icons/triangle_up.svg'
    ],
    fontName: 'extraicons',
    formats: ['ttf']
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
