# font-ligatures

[![Travis CI build status](https://travis-ci.org/princjef/font-ligatures.svg?branch=master)](https://travis-ci.org/princjef/font-ligatures)
[![codecov](https://codecov.io/gh/princjef/font-ligatures/branch/master/graph/badge.svg)](https://codecov.io/gh/princjef/font-ligatures)
[![npm version](https://img.shields.io/npm/v/font-ligatures.svg)](https://npmjs.org/package/font-ligatures)

Find ligature replacements for any system font. Useful for determining glyph
substitutions and ranges where ligatures exist within a string of input text.

```
npm install font-ligatures
```

## Usage

```js
const fontLigatures = require('font-ligatures');

(async () => {
  const font = await fontLigatures.load('Iosevka');
  console.log(font.findLigatures('in --> out'));
  // {
  //   inputGlyphs:   [ 76, 81, 3, 16,   16,   33, 3, 82, 88, 87 ],
  //   outputGlyphs:  [ 76, 81, 3, 3140, 3128, 33, 3, 82, 88, 87 ],
  //   contextRanges: [ [ 3, 6 ] ]
  // }
})();
```

## API

### `load(name, [options])`

Loads the font with the given name, returning a Promise with a [Font](#font)
that can be used to find ligature information.

**Params**

 * `name` [*string*] - The font family of the font to load
 * `options` [*object*] - Optional configuration object containing the following
   keys:
    * `cacheSize` [*number*] - The amount of data from previous results to cache
      within the parser. The size is measured by the length of the input text
      for each call. Turned off by default.

### `loadFile(path, [options])`

Loads the font at the given path, returning a Promise with a [Font](#font) that
can be used to find ligature information.

**Params**

 * `path` [*string*] - Path to the file containing the font
 * `options` [*object*] - Optional configuration object containing the following
   keys:
    * `cacheSize` [*number*] - The amount of data from previous results to cache
      within the parser. The size is measured by the length of the input text
      for each call. Turned off by default.

### Font

Object returned by `load()`. Includes the following methods:

#### `findLigatures(text)`

Scans the provided text for font ligatures, returning an object with the
following keys:

 * `inputGlyphs` [*number[]*] - The list of font glyphs in the input text.
 * `outputGlyphs` [*number[]*] - The list of font glyphs after performing
   replacements for font ligatures.
 * `contextRanges` [*[number, number]\[\]*] - Sorted array of ranges that must
   be rendered together to produce the ligatures in the output sequence. The
   ranges are inclusive on the left and exclusive on the right

#### `findLigatureRanges(text)`

Scans the provided text for font ligatures, returning an array of ranges where
ligatures are located.

**Params**

 * `text` [*string*] - text to search for ligatures

## Font Support

This library is designed to support fonts that make use of programming
ligatures. As a result, it is tested against all of the ligatures produced by
the following fonts:

 * [Fira Code][]
 * [Iosevka][]
 * [Monoid][]

If there is another font that you use which doesn't seem to be working, please
open an issue with the font information and where to get it. The most likely
cause is that the font uses a type of substitution which is not yet supported.

## Contributing

Want to contribute to the project? Go check out the [Contribution 
Guide](CONTRIBUTING.md) for instructions to set up your development 
environment, open an issue and create a pull request.

[Fira Code]: https://github.com/tonsky/FiraCode
[Iosevka]: https://be5invis.github.io/Iosevka
[Monoid]: https://larsenwork.com/monoid
