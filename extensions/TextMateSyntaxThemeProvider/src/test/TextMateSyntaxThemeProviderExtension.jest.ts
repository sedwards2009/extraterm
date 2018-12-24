/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import * as path from "path";

import { getLogger } from "extraterm-logging";

import { TextMateSyntaxThemeProvider } from "../TextMateSyntaxThemeProviderExtension";


const themePaths = [path.join(__dirname, "..", "..", "src", "test")];

test("scan", () => {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new TextMateSyntaxThemeProvider(logger);
  const themeList = provider.scanThemes(themePaths);

  expect(themeList.length).toBe(1);
  expect(themeList[0].name).toBe("3024 Night");
});

test("read", () => {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new TextMateSyntaxThemeProvider(logger);
  const themeContents = provider.readTheme(themePaths, "3024 Night.tmTheme");

  expect(themeContents.foreground).toBe("#a5a2a2");
  const invalidIllegalList = themeContents.syntaxTokenRule.filter(rule => rule.scope === "invalid.illegal");
  expect(invalidIllegalList.length).toBe(1);
  expect(invalidIllegalList[0].textStyle.foregroundColor).toBe("#090300");
  expect(invalidIllegalList[0].textStyle.backgroundColor).toBe("#db2d20");

  const markupItalicList = themeContents.syntaxTokenRule.filter(rule => rule.scope === "markup.italic");
  expect(markupItalicList.length).toBe(1);
  expect(markupItalicList[0].textStyle.italic).toBe(true);
  expect(markupItalicList[0].textStyle.underline).not.toBe(true);
});
