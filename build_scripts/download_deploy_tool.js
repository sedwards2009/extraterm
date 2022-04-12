/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as download_utilities from './download_utilities.js';

const log = console.log.bind(console);


const DOWNLOADS_DIR = 'downloads';

async function main() {
  const version = 5;
  const url = `https://github.com/probonopd/linuxdeployqt/releases/download/${version}/linuxdeployqt-${version}-x86_64.AppImage`

  if (process.platform === "linux") {
    const exe = await download_utilities.fetchUrl(url);
    const dirPath = path.join(DOWNLOADS_DIR, 'linux-x64');
    sh.mkdir('-p', dirPath);
    const outputPath = path.join(dirPath, 'linuxdeployqt-x86_64.AppImage');
    fs.writeFileSync(outputPath, exe);
    fs.chmodSync(outputPath, 0o777);
    log("");
    log("Done.");
  } else {
    log("Nothing to download for this platform. It is all good!");
  }

// log(exe);
}

main();
