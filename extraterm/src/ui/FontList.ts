/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { QFontDatabase } from "@nodegui/nodegui";
import { getLogger } from "extraterm-logging";
import { FontInfo } from "../config/Config";


const log = getLogger("FontList");

export function installBundledFonts(): void {

}

export function getFonts(): FontInfo[] {
  const result: FontInfo[] = [];
  const db = new QFontDatabase();
  for (const family of db.families()) {
    for (const style of db.styles(family)) {
      // log.debug(`${family} ${style} = ${db.isFixedPitch(family, style)}`);
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
