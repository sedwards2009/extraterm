/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as download_utilities from './download_utilities.mjs';

const log = console.log.bind(console);

const DOWNLOADS_DIR = 'downloads';

async function main(version) {
  const baseUrl = `https://github.com/sedwards2009/extraterm-commands/releases/download/${version}/`;
    const zipFilename = `extraterm-commands-${version.replace("v", "")}.zip`;
    const zipFileData = await download_utilities.fetchUrl(`${baseUrl}/${zipFilename}`);
    sh.mkdir('-p', DOWNLOADS_DIR);
    fs.writeFileSync(path.join(DOWNLOADS_DIR, zipFilename), zipFileData);
}

if (process.argv.length <= 2) {
  log("The version number should be passed as the first parameter to this script. i.e. v3");
  process.exit(1);
}

main(process.argv[process.argv.length-1]);
