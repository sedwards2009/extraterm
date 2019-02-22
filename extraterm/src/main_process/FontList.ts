/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from 'child_process';
import * as path from 'path';
import * as SourceDir from '../SourceDir';

/**
 * This uses the external `list-fonts-json` utility to list the available system fonts.
 * See `list-fonts-json` at https://github.com/sedwards2009/list-fonts-json
 */

export interface FontDescriptor {  
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

export function getAvailableFontsSync(): FontDescriptor[] {
  if (fonts == null) {
    const exeName = process.platform === "win32" ? "list-fonts-json.exe" : "list-fonts-json";
    const listFontsJsonExe = path.join(SourceDir.path,
      `../resources/list-fonts-json-binary/${process.platform}-${process.arch}/${exeName}`);

    const fontJson = child_process.execFileSync(listFontsJsonExe, []);
    fonts = <FontDescriptor[]> JSON.parse(fontJson);
  }
  return fonts;
}
