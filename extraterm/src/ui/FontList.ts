/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { QFontDatabase } from "@nodegui/nodegui";
import { getLogger } from "extraterm-logging";
import { FontInfo } from "../config/Config";
import * as fs from "fs";
import * as path from 'path';


const TERMINAL_FONTS_DIRECTORY = "../../resources/terminal_fonts";

const log = getLogger("FontList");


export function getFonts(): FontInfo[] {
  const result: FontInfo[] = [];
  const db = new QFontDatabase();
  for (const family of db.families()) {
    for (const style of db.styles(family)) {
      log.debug(`${family} ${style} = ${db.isFixedPitch(family, style)}`);
      const fontInfo: FontInfo = {
        name: `${family} ${style}`,
        family,
        style,
        id: `${family}-${style}`
      };
      result.push(fontInfo);
    }
  }

  return result;
}

export function installBundledFonts(): void {
  const fontsDir = path.join(__dirname, TERMINAL_FONTS_DIRECTORY);
  if (fs.existsSync(fontsDir)) {
    const contents = fs.readdirSync(fontsDir);
    contents.forEach( (item) => {
      if (item.endsWith(".ttf")) {
        const ttfPath = path.join(fontsDir, item);
        QFontDatabase.addApplicationFont(ttfPath);
      }
    });
  }
}
