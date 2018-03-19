/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import { parsePackageJson } from './PackageFileParser';

export function testBasic(test: nodeunit.Test): void {
  const parsed = parsePackageJson({
    name: "Foo", version: "1.0.0", description: "Foobar"
  }, "");
  test.equal(parsed.name, "Foo");
  test.equal(parsed.version, "1.0.0");
  test.equal(parsed.description, "Foobar");
  test.equal(parsed.contributions.viewer.length, 0);

  test.done();
}

export function testViewer(test: nodeunit.Test): void {
  const parsed = parsePackageJson({
    name: "Foo",
    version: "1.0.0",
    description: "Foobar",
    contributions: {
      viewer: [{name: "SmegViewer", mimeTypes: ["foo/bar"]}]
    }
  }, "");

  test.equal(parsed.name, "Foo");
  test.equal(parsed.version, "1.0.0");
  test.equal(parsed.description, "Foobar");
  test.equal(parsed.contributions.viewer.length, 1);
  test.equal(parsed.contributions.viewer[0].name, "SmegViewer");
  test.equal(parsed.contributions.viewer[0].mimeTypes.length, 1);
  test.equal(parsed.contributions.viewer[0].mimeTypes[0], "foo/bar");

  test.done();
}
