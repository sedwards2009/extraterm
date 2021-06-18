const fontManager = require('font-manager');


const monofonts = fontManager.findFontsSync(  { monospace: true}); //.map( (font) => font.path);

const fonts = fontManager.getAvailableFontsSync();
const monofonts2 = fonts.filter( (font) => font.monospace).map( (font) => font.path);

monofonts.sort();
monofonts2.sort();

console.log("[findFonts]-----------------");
console.log(JSON.stringify(monofonts, null, "  "));
console.log("[getAvailableFonts & filter]-----------------");
// console.log(JSON.stringify(monofonts2, null, "  "));

