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

async function main(version) {
  const baseUrl = `https://github.com/sedwards2009/extraterm-launcher/releases/download/${version}/`;

  if (process.platform === "linux") {
    const exe = await download_utilities.fetchUrl(`${baseUrl}/extraterm-launcher-linux`);
    const dirPath = path.join(DOWNLOADS_DIR, 'linux-x64');
    sh.mkdir('-p', dirPath);
    fs.writeFileSync(path.join(dirPath, 'extraterm-launcher'), exe);
  }

  if (process.platform === "darwin") {
    const exe = await download_utilities.fetchUrl(`${baseUrl}/extraterm-launcher-macos`);
    const dirPath = path.join(DOWNLOADS_DIR, 'darwin-x64');
    sh.mkdir('-p', dirPath);
    fs.writeFileSync(path.join(dirPath, 'extraterm-launcher'), exe);
  }

  if (process.platform === "win32") {
    const exe = await download_utilities.fetchUrl(`${baseUrl}/extraterm-launcher-windows.exe`);
    const windowPath = path.join(DOWNLOADS_DIR, 'win32-x64');
    sh.mkdir('-p', windowPath);
    fs.writeFileSync(path.join(windowPath, 'extraterm-launcher.exe'), exe);
  }

// log(exe);
}

if (process.argv.length <= 2) {
  log("The version number should be passed as the first parameter to this script. i.e. v3");
  process.exit(1);
}

main(process.argv[process.argv.length-1]);
