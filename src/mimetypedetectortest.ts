/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import sourceMapSupport = require('source-map-support');
import fs = require('fs');
import path = require('path');
import nodeunit = require('nodeunit');
import mimetypedetector = require('./mimetypedetector');

sourceMapSupport.install();

function readTestFile(filename: string): Buffer {
  const fullPath = path.join('src', 'testfiles', filename);
  return fs.readFileSync(fullPath);
}

export function testPng(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("1x1.png"));
  test.notEqual(result, null);
  test.equal("image/png", result.mimeType);
  test.done();
}

export function testGif(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("blank.gif"));
  test.notEqual(result, null);
  test.equal("image/gif", result.mimeType);
  test.done();
}

export function testBmp(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("blank.bmp"));
  test.notEqual(result, null);
  test.equal("image/bmp", result.mimeType);
  test.done();
}

export function testJpeg(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("blank.jpg"));
  test.notEqual(result, null);
  test.equal("image/jpeg", result.mimeType);
  test.done();
}

export function testWebp(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("blank.webp"));
  test.notEqual(result, null);
  test.equal("image/webp", result.mimeType);
  test.done();
}

export function testASCII(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("ascii.txt"));
  test.notEqual(result, null);
  test.equal("text/plain", result.mimeType);
  test.done();
}

// Random binary data.
export function testRandom(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("random.bin"));
  test.notEqual(result, null);
  test.equal("application/octet-stream", result.mimeType);
  test.done();
}

// Part of a linux lib.so file.
export function testLibSo(test: nodeunit.Test): void {
  const result = mimetypedetector.detect(null, readTestFile("libso.bin"));
  test.notEqual(result, null);
  test.equal("application/octet-stream", result.mimeType);
  test.done();
}
