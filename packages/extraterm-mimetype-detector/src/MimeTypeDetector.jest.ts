/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";

import * as fs from 'fs';
import * as path from 'path';
import * as MimeTypeDetector from './MimeTypeDetector';


function readTestFile(filename: string): Buffer {
  const fullPath = path.join("testfiles", filename);
  return fs.readFileSync(fullPath);
}

describe.each([
  ["Png", "1x1.png", "image/png"],
  ["Gif", "blank.gif", "image/gif"],
  ["Bmp", "blank.bmp", "image/bmp"],
  ["Jpeg", "blank.jpg", "image/jpeg"],
  ["Webp", "blank.webp", "image/webp"],
  ["ASCII", "ascii.txt", "text/plain"],
  // Random binary data.
  ["Random", "random.bin", "application/octet-stream"],
  // Part of a linux lib.so file.
  ["LibSo", "libso.bin", "application/octet-stream"],
  ["Shell Script", "foo.sh", "text/plain"],
  ["Fish shell script", "foo.fish", "text/plain"],
  ["ini file", "foo.ini", "text/plain"],
])("", (name: string, filename: string, mimeType: string) => {
  test(`${name} => ${mimeType}`, () => {
    const result = MimeTypeDetector.detect(null, readTestFile(filename));
    expect(result).not.toBe(null);
    expect(result.mimeType).toBe(mimeType);
  });
});
