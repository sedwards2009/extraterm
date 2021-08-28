/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodePath from "path";

// This is a bit of a hack to find the path to the source code and other resources
// in a way that works during development and also from a packaged version.
export const path = require.resolve('./SourceDir').slice(0,-12);

let posixSourcePath = path;
if (process.platform === "win32") {
  posixSourcePath = nodePath.posix.join(...path.split(nodePath.sep));
}
// Like `path` but with forward slashes instead of backwards.
export const posixPath = posixSourcePath;
