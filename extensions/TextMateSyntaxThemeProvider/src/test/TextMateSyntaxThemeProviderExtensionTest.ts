/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodeunit from "nodeunit";
import * as path from "path";

import { getLogger } from "extraterm-logging";

import { TextMateSyntaxThemeProvider } from "../TextMateSyntaxThemeProviderExtension";


const themePaths = [path.join(__dirname, "..", "..", "src", "test")];

export function testScan(test: nodeunit.Test): void {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new TextMateSyntaxThemeProvider(logger);
  const themeList = provider.scanThemes(themePaths);

  test.equal(themeList.length, 1);
  test.equal(themeList[0].name, "3024 Night");
  test.done();
}

export function testRead(test: nodeunit.Test): void {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new TextMateSyntaxThemeProvider(logger);
  const themeContents = provider.readTheme(themePaths, "3024 Night.tmTheme");

  test.equal(themeContents.foreground, "#a5a2a2");
  const invalidIllegalList = themeContents.syntaxTokenRule.filter(rule => rule.scope === "invalid.illegal");
  test.equals(invalidIllegalList.length, 1);
  test.equals(invalidIllegalList[0].textStyle.foregroundColor, "#090300");
  test.equals(invalidIllegalList[0].textStyle.backgroundColor, "#db2d20");

  const markupItalicList = themeContents.syntaxTokenRule.filter(rule => rule.scope === "markup.italic");
  test.equals(markupItalicList.length, 1);
  test.equals(markupItalicList[0].textStyle.italic, true);
  test.notEqual(markupItalicList[0].textStyle.underline, true);
 
  test.done();
}