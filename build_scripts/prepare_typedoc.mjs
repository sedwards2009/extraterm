/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// This thing throws all of the TS code into a directory for typedoc to chew
// on, because there was no way to prevent typedoc from scanning everything
// under the node_modules directory.
//
// This is called from an npm script.

import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';

const log = console.log.bind(console);
const TYPEDOC_TMP = 'build_tmp';

function main() {
  if (sh.test('-d', TYPEDOC_TMP)) {
    sh.rm('-r', TYPEDOC_TMP);
  }
  sh.mkdir(TYPEDOC_TMP);

  const tsconfigStr = fs.readFileSync('../tsconfig.json', { encoding: 'utf8'});
  const tsconfig = JSON.parse(tsconfigStr);

  tsconfig.files.forEach( (fileName) => {
    const targetDir = path.join(TYPEDOC_TMP, path.dirname(fileName.substr(6)));
    if ( ! sh.test('-d', targetDir)) {
      sh.mkdir('-p', targetDir);
    }
    sh.cp(fileName.substr(6), targetDir);
  });
}

function endsWith(source, tail) {
  return source.indexOf(tail) === source.length - tail.length;
}

main();
