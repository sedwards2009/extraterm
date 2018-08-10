/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodeunit from "nodeunit";
import * as path from "path";

import { getLogger } from "extraterm-logging";

import { ItermColorTerminalThemeProvider } from "../ITermColorsTerminalThemeProviderExtension";


const themePaths = [path.join(__dirname, "..", "..", "src", "test")];

export function testScan(test: nodeunit.Test): void {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new ItermColorTerminalThemeProvider(logger);
  const themeList = provider.scanThemes(themePaths);

  test.equal(themeList.length, 1);
  test.equal(themeList[0].name, "Dracula");
  test.done();
}

export function testRead(test: nodeunit.Test): void {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new ItermColorTerminalThemeProvider(logger);
  const themeContents = provider.readTheme(themePaths, "Dracula.itermcolors");

  test.equal(themeContents[0], "#000000");
  test.equal(themeContents[1], "#ff5555");
	test.equal(themeContents.foregroundColor, "#f8f8f2");
 
  test.done();
}