/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { parsePackageJson } from './PackageFileParser';

test("metadata", () => {
  const parsed = parsePackageJson({
    name: "Foo", version: "1.0.0", description: "Foobar"
  }, "");
  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.viewers.length).toBe(0);
});

test("contributes", () => {
  const parsed = parsePackageJson({
    name: "Foo",
    version: "1.0.0",
    description: "Foobar",
    contributes: {
      viewers: [{name: "SmegViewer", mimeTypes: ["foo/bar"]}]
    }
  }, "");

  expect(parsed.name).toBe("Foo");
  expect(parsed.version).toBe("1.0.0");
  expect(parsed.description).toBe("Foobar");
  expect(parsed.contributes.viewers.length).toBe(1);
  expect(parsed.contributes.viewers[0].name).toBe("SmegViewer");
  expect(parsed.contributes.viewers[0].mimeTypes.length).toBe(1);
  expect(parsed.contributes.viewers[0].mimeTypes[0]).toBe("foo/bar");
});

test("platform", () => {
  const parsed = parsePackageJson({
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
  }, "");

  expect(parsed.includePlatform.length).toBe(1);
  expect(parsed.includePlatform[0].os).toBe("linux");
  expect(parsed.includePlatform[0].arch).toBe("x64");
  expect(parsed.excludePlatform.length).toBe(2);
  expect(parsed.excludePlatform[0].os).toBe("macos");
  expect(parsed.excludePlatform[0].arch).toBe(null);
  expect(parsed.excludePlatform[1].arch).toBe("mips");
});

