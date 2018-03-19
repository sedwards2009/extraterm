/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

declare module 'font-manager' {
  
  interface FontDescriptor {  
    path: string;            // The path to the font file in the filesystem. (not applicable for queries, only for results)
    postscriptName: string;  // The PostScript name of the font (e.g 'Arial-BoldMT'). This uniquely identities a font in most cases.
    family: string;          // The font family name (e.g 'Arial')
    style: string;           // The font style name (e.g. 'Bold')
    weight: number;          // The font weight (e.g. 400 for normal weight). Should be a multiple of 100, between 100 and 900. See below for weight documentation.
    width: number;           // The font width (e.g. 5 for normal width). Should be an integer between 1 and 9. See below for width documentation.
    italic: boolean;         // Whether the font is italic or not.
    monospace: boolean;
  }

  interface FontPattern {
    path?: string;            // The path to the font file in the filesystem. (not applicable for queries, only for results)
    postscriptName?: string;  // The PostScript name of the font (e.g 'Arial-BoldMT'). This uniquely identities a font in most cases.
    family?: string;          // The font family name (e.g 'Arial')
    style?: string;           // The font style name (e.g. 'Bold')
    weight?: number;          // The font weight (e.g. 400 for normal weight). Should be a multiple of 100, between 100 and 900. See below for weight documentation.
    width?: number;           // The font width (e.g. 5 for normal width). Should be an integer between 1 and 9. See below for width documentation.
    italic?: boolean;         // Whether the font is italic or not.
    monospace?: boolean;
  }

  
  function getAvailableFonts(callback: (fonts: FontDescriptor[]) => void): void;
  function getAvailableFontsSync(): FontDescriptor[];
  function findFonts(fontPattern: FontPattern, callback: (fonts: FontDescriptor[]) => void): void;
  function findFontsSync(fontPattern: FontPattern): FontDescriptor[];
  function findFont(fontPattern: FontPattern, callback: (font: FontDescriptor) => void): void;
  function findFontSync(fontPattern: FontPattern): FontDescriptor;
  function substituteFont(name: string, chars: string, callback: (font: FontDescriptor) => void): void;
  function substituteFontSync(name: string, chars: string): FontDescriptor;
}
