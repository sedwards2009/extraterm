/*
 * Copyright 2018-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "node:path";
import * as fs from "node:fs";
import sh from "shelljs";
import { parsePackageJsonString } from "./PackageFileParser.js";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);

test("metadata", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    name: "Foo", version: "1.0.0", description: "Foobar"
  }), "");
  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.blocks.length).toBe(0);
});

test("isInternal", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    name: "Foo", version: "1.0.0", description: "Foobar", isInternal: true
  }), "");
  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.blocks.length).toBe(0);
  expect(parsed.isInternal).toBe(true);
});

test("contributes", () => {
  const parsed = parsePackageJsonString(JSON.stringify({
    name: "Foo",
    version: "1.0.0",
    description: "Foobar",
    contributes: {
      blocks: [{name: "SmegViewer", mimeTypes: ["foo/bar"]}]
    }
  }), "");

  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.blocks.length).toBe(1);
  expect(parsed.contributes.blocks[0].name).toBe("SmegViewer");
  expect(parsed.contributes.blocks[0].mimeTypes.length).toBe(1);
  expect(parsed.contributes.blocks[0].mimeTypes[0]).toBe("foo/bar");
});

test("blocks", () => {
  const parsed = parsePackageJsonString(JSON.stringify(
    {
      "name": "download-block",
      "description": "Download Block",
      "version": "1.0.0",
      "exports": "src/DownloadBlockExtension.js",
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
        "blocks": [
          {
            "name": "download-block",
            "mimeTypes": [
              "audio/vorbis",
              "audio/mpeg"
            ]
          }
        ]
      }
    }), "");
  expect(parsed.name).toBe("download-block");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.exports).toBe("src/DownloadBlockExtension.js");
  expect(parsed.contributes.blocks.length).toBe(1);
  expect(parsed.contributes.blocks[0].name).toBe("download-block");
  expect(parsed.contributes.blocks[0].mimeTypes.length).toBe(2);
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

const extensionsPath = path.join(__filename, "..", "..", "..", "..", "extensions");
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
        "name": "title"
      }
    ],
  }
}), "");
  expect(parsed.contributes.tabTitleWidgets.length).toBe(1);
  expect(parsed.contributes.tabTitleWidgets[0].name).toBe("title");
});
