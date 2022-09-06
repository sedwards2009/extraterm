/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";
import * as opentype from "opentype.js";
import { QFontDatabase } from "@nodegui/nodegui";
import { getLogger } from "extraterm-logging";
import { PairKeyMap } from "extraterm-data-structures";

import { FontInfo } from "../config/Config.js";
import * as SourceDir from "../SourceDir.js";


const __dirname = SourceDir.path;

const TERMINAL_FONTS_DIRECTORY = "../resources/terminal_fonts";

const log = getLogger("FontList");

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

function getAllFontsDetails(): FontDescriptor[] {
  if (fonts == null) {
    const exeName = process.platform === "win32" ? "list-fonts-json.exe" : "list-fonts-json";
    const listFontsJsonExe = path.join(SourceDir.path,
      `../resources/list-fonts-json-binary/${process.platform}-${process.arch}/${exeName}`);

    const fontJson = child_process.execFileSync(listFontsJsonExe, [], { encoding: "utf8", maxBuffer: 10*1024*1024} );
    fonts = <FontDescriptor[]> JSON.parse(fontJson);
  }
  return fonts;
}


function indexFontPaths(fontDescriptors: FontDescriptor[]): PairKeyMap<string, string, string> {
  const mapping = new PairKeyMap<string, string, string>();
  for (const fontDescriptor of fontDescriptors) {
    mapping.set(fontDescriptor.family, fontDescriptor.style, fontDescriptor.path);
  }
  return mapping;
}


export function getFonts(): FontInfo[] {
  const fsFonts = getAllFontsDetails();
  const fontFileMapping = indexFontPaths(fsFonts);

  const result: FontInfo[] = [];
  const db = new QFontDatabase();
  for (const family of db.families()) {
    for (const style of db.styles(family)) {
      if (style !== "Regular" && style !== "Book") {
        continue;
      }
      let fontPath = fontFileMapping.get(family, style);
      if (fontPath == null) {
        fontPath = appFontMapping.get(family, style);
      }

      const fontInfo: FontInfo = {
        name: `${family}`,
        family,
        style,
        id: `${family}`,
        path: fontPath || null
      };
      result.push(fontInfo);
    }
  }

  return result;
}

const appFontMapping = new PairKeyMap<string, string, string>();

export async function installBundledFonts(): Promise<void> {
  const fontsDir = path.join(__dirname, TERMINAL_FONTS_DIRECTORY);
  if (fs.existsSync(fontsDir)) {
    const contents = fs.readdirSync(fontsDir);
    for (const item of contents) {
      if (item.endsWith(".ttf")) {
        const ttfPath = path.join(fontsDir, item);

        const fontDetails = await getFontDetails(ttfPath);
        appFontMapping.set(fontDetails.family, fontDetails.style, ttfPath);

        QFontDatabase.addApplicationFont(ttfPath);
      }
    }
  }
}

async function getFontDetails(ttfPath: string): Promise<{family: string; style: string;}> {
  const font = await util.promisify<string, opentype.Font>(opentype.load as any)(ttfPath);
  const family = font.tables.name.fontFamily?.en;
  const style = font.tables.name.fontSubfamily?.en;
  return {
    family,
    style
  };
}
