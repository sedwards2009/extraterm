/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from 'child_process';
import * as fs from "fs";
import * as _ from "lodash";
import * as path from 'path';
import * as SourceDir from '../SourceDir';
import fontInfo = require("fontinfo");
import { FontInfo } from "../Config";

const isWindows = process.platform === "win32";

const TERMINAL_FONTS_DIRECTORY = "../../resources/terminal_fonts";

/**
 * This uses the external `list-fonts-json` utility to list the available system fonts.
 * See `list-fonts-json` at https://github.com/sedwards2009/list-fonts-json
 */

interface FontDescriptor {
  path: string;            // The path to the font file in the filesystem. (not applicable for queries, only for results)
  postscriptName: string;  // The PostScript name of the font (e.g 'Arial-BoldMT'). This uniquely identities a font in most cases.
  family: string;          // The font family name (e.g 'Arial')
  style: string;           // The font style name (e.g. 'Bold')
  weight: number;          // The font weight (e.g. 400 for normal weight). Should be a multiple of 100, between 100 and 900. See below for weight documentation.
  width: number;           // The font width (e.g. 5 for normal width). Should be an integer between 1 and 9. See below for width documentation.
  italic: boolean;         // Whether the font is italic or not.
  oblique: boolean;
  monospace: boolean;
}

let fonts: FontDescriptor[] = null;

function getAvailableFontsSync(): FontDescriptor[] {
  if (fonts == null) {
    const exeName = process.platform === "win32" ? "list-fonts-json.exe" : "list-fonts-json";
    const listFontsJsonExe = path.join(SourceDir.path,
      `../resources/list-fonts-json-binary/${process.platform}-${process.arch}/${exeName}`);

    const fontJson = child_process.execFileSync(listFontsJsonExe, [], { encoding: "utf8", maxBuffer: 10*1024*1024} );
    fonts = <FontDescriptor[]> JSON.parse(fontJson);
  }
  return fonts;
}

export function getFonts(): FontInfo[] {
  const allAvailableFonts = getAvailableFontsSync();
  const usableFonts = allAvailableFonts.filter(fontInfo => {
    const path = fontInfo.path.toLowerCase();
    if ( ! path.endsWith(".ttf") && ! path.endsWith(".otf") && ! path.endsWith(".dfont")) {
      return false;
    }
    if (fontInfo.italic || fontInfo.style.indexOf("Oblique") !== -1) {
      return false;
    }
    if (fontInfo.weight > 600) {
      return false;
    }

    return true;
  });

  const systemFonts = usableFonts.map(result => {
    const name = result.family + (result.style==="Regular" ? "" : " " + result.style) +
      (result.italic && result.style.indexOf("Italic") === -1 ? " Italic" : "");
    const fontInfo: FontInfo = {
      name: name,
      path: pathToUrl(result.path),
      postscriptName: result.postscriptName
    };
    return fontInfo;
  } );

  const allFonts = [...getBundledFonts(), ...systemFonts];
  const fonts = _.uniqBy(allFonts, x => x.postscriptName);
  return fonts;
}

function getBundledFonts(): FontInfo[] {
  const fontsDir = path.join(__dirname, TERMINAL_FONTS_DIRECTORY);
  const result: FontInfo[] = [];
  if (fs.existsSync(fontsDir)) {
    const contents = fs.readdirSync(fontsDir);
    contents.forEach( (item) => {
      if (item.endsWith(".ttf")) {
        const ttfPath = path.join(fontsDir, item);
        const fi = fontInfo(ttfPath);
        result.push( {
          path: pathToUrl(ttfPath),
          name: fi.name.fontName,
          postscriptName: fi.name.postscriptName
        });
      }
    });
  }

  return result;
}

function pathToUrl(path: string): string {
  if (isWindows) {
    return path.replace(/\\/g, "/");
  }
  return path;
}
