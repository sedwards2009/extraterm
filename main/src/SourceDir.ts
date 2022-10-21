/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodePath from "node:path";
import {fileURLToPath} from "node:url";

declare const __dirname: string;  // Common JS

// This is a bit of a hack to find the path to the source code and other
// resources in a way that works during development and also from a
// packaged version.
// The 'if()' below is another hack to make this code work if it is running
// as ESM or Node style commonjs, which can happen when bundlers are involved
// and the code suddenly is being loaded as cjs. esbuild can convert ESM to
// cjs but it does support translating `import.meta.url`. So we test for it.
let dirPath = "";
if (import.meta.url !== undefined) {
  dirPath = fileURLToPath(import.meta.url).slice(0,-12);
} else {
  // Common JS environment.
  dirPath = __dirname;
}
export const path = dirPath;

let posixSourcePath = path;
if (process.platform === "win32") {
  posixSourcePath = nodePath.posix.join(...path.split(nodePath.sep));
}
// Like `path` but with forward slashes instead of backwards.
export const posixPath = posixSourcePath;
