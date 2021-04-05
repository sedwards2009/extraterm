/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { parsePackageJsonString } from './PackageFileParser';
import * as path from 'path';
import * as fs from 'fs';
import * as sh from "shelljs";

test("metadata", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    name: "Foo", version: "1.0.0", description: "Foobar"
  }), "");
  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.viewers.length).toBe(0);
});

test("isInternal", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    name: "Foo", version: "1.0.0", description: "Foobar", isInternal: true
  }), "");
  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.viewers.length).toBe(0);
  expect(parsed.isInternal).toBe(true);
});

test("contributes", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    name: "Foo",
    version: "1.0.0",
    description: "Foobar",
    contributes: {
      viewers: [{name: "SmegViewer", mimeTypes: ["foo/bar"]}]
    }
  }), "");

  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.viewers.length).toBe(1);
  expect(parsed.contributes.viewers[0].name).toBe("SmegViewer");
  expect(parsed.contributes.viewers[0].mimeTypes.length).toBe(1);
  expect(parsed.contributes.viewers[0].mimeTypes[0]).toBe("foo/bar");
});

test("viewers", () => {
  const parsed = parsePackageJsonString(JSON.stringify(
    {
      "name": "audio-viewer",
      "description": "Audio viewer",
      "version": "1.0.0",
      "main": "src/AudioViewerExtension.js",
      "scripts": {
        "build": "tsc"
      },
      "dependencies": {
        "vue": "2.5.9",
        "vue-class-component": "6.1.0"
      },
      "devDependencies": {
        "@types/node": "7.0.5",
        '@extraterm/extraterm-extension-api': "0.1.0",
        "typescript": "3.1.6"
      },
      "contributes": {
        "viewers": [
          {
            "name": "AudioViewer",
            "mimeTypes": [
              "audio/vorbis",
              "audio/mpeg"
            ],
            "css": {
              "directory": "resources/sass",
              "cssFile": [
                "audio-viewer.scss"
              ],
              "fontAwesome": true
            }
          }
        ]
      }
    }), "");
  expect(parsed.name).toBe("audio-viewer");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.main).toBe("src/AudioViewerExtension.js");
  expect(parsed.contributes.viewers.length).toBe(1);
  expect(parsed.contributes.viewers[0].name).toBe("AudioViewer");
  expect(parsed.contributes.viewers[0].mimeTypes.length).toBe(2);
  expect(parsed.contributes.viewers[0].css.directory).toBe("resources/sass");
  expect(parsed.contributes.viewers[0].css.cssFile.length).toBe(1);
  expect(parsed.contributes.viewers[0].css.cssFile[0]).toBe("audio-viewer.scss");
  expect(parsed.contributes.viewers[0].css.fontAwesome).toBe(true);
});

test("platform", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    name: "Foo",
    version: "1.0.0",
    description: "Foobar",
    includePlatform: [
      {
        os: "linux",
        arch: "x64"
      }
    ],
    excludePlatform: [
      {
        os: "macos"
      },
      {
        arch: "mips"
      }
    ]
  }), "");

  expect(parsed.includePlatform.length).toBe(1);
  expect(parsed.includePlatform[0].os).toBe("linux");
  expect(parsed.includePlatform[0].arch).toBe("x64");
  expect(parsed.excludePlatform.length).toBe(2);
  expect(parsed.excludePlatform[0].os).toBe("macos");
  expect(parsed.excludePlatform[0].arch).toBe(null);
  expect(parsed.excludePlatform[1].arch).toBe("mips");
});

test("syntax themes", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    "name": "community-syntax-themes",
    "description": "Popular syntax themes from the community",
    "version": "1.0.0",
    "contributes": {
      "syntaxThemes": [
        {
          "path": "theme"
        }
      ]
    }
  }), "");

  expect(parsed.name).toBe("community-syntax-themes");
  expect(parsed.contributes.syntaxThemes.length).toBe(1);
  expect(parsed.contributes.syntaxThemes[0].path).toBe("theme");
});

const extensionsPath = path.join(__filename, "..", "..", "..", "..", "..", "extensions");
describe.each(
  sh.ls(extensionsPath)
)("Parse extensions package.json files", (input) => {

  test(`parse "${input}"`, () => {
    const packageJsonString = fs.readFileSync(path.join(extensionsPath, input, "package.json"), "utf8");
    parsePackageJsonString(packageJsonString, input);
  });
});

test("tab title widgets", () => {
  const parsed = parsePackageJsonString(JSON.stringify(
{
  "name": "tab-title",
  "description": "",
  "version": "1.0.0",
  "contributes": {
    "tabTitleWidgets": [
      {
        "name": "title",
        "css": {
          "fontAwesome": true
        }
      }
    ],
  }
}), "");
  expect(parsed.contributes.tabTitleWidgets.length).toBe(1);
  expect(parsed.contributes.tabTitleWidgets[0].name).toBe("title");
});
