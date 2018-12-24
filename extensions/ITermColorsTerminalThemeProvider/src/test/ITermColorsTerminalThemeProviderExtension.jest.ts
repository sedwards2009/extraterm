/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import * as path from "path";
import { getLogger } from "extraterm-logging";
import { ItermColorTerminalThemeProvider } from "../ITermColorsTerminalThemeProviderExtension";


const themePaths = [path.join(__dirname, "..", "..", "src", "test")];

test("scan", () => {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new ItermColorTerminalThemeProvider(logger);
  const themeList = provider.scanThemes(themePaths);

  expect(themeList.length).toBe(1);
  expect(themeList[0].name).toBe("Dracula");
});

test("read", () => {
  const logger = getLogger("TextMateSyntaxThemeProvider");

  const provider = new ItermColorTerminalThemeProvider(logger);
  const themeContents = provider.readTheme(themePaths, "Dracula.itermcolors");

  expect(themeContents[0]).toBe("#000000");
  expect(themeContents[1]).toBe("#ff5555");
	expect(themeContents.foregroundColor).toBe("#f8f8f2");
});
