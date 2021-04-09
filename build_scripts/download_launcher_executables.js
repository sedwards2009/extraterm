/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const https = require('https');
const fs = require('fs');
const path = require('path');


const log = console.log.bind(console);

async function fetchUrl(url) {
  log(`Downloading ${url}`);
  return new Promise( (resolve, reject) => {
    https.get(url, {}, (resp) => {
      // log(resp.headers);
      // log(`statusCode: ${resp.statusCode}`);

      if (resp.statusCode === 302) {
        fetchUrl(resp.headers.location).then(data => resolve(data));
        return;
      }

      const data = [];
      resp.on('data', (chunk) => {
        data.push(chunk);
      });

      resp.on('end', () => {
        resolve(Buffer.concat(data));
      });
    }).on("error", (err) => {
      log("Error: " + err.message);
      reject("Error: " + err.message);
    });
  });
}

const DOWNLOADS_DIR = 'downloads';

async function main(version) {
  const baseUrl = `https://github.com/sedwards2009/extraterm-launcher/releases/download/${version}/`;

  if (process.platform === "linux") {
    const exe = await fetchUrl(`${baseUrl}/extraterm-launcher-linux`);
    const dirPath = path.join(DOWNLOADS_DIR, 'linux-x64');
    mkdir('-p', dirPath);
    fs.writeFileSync(path.join(dirPath, 'extraterm-launcher'), exe);
  }

  if (process.platform === "darwin") {
    const exe = await fetchUrl(`${baseUrl}/extraterm-launcher-macos`);
    const dirPath = path.join(DOWNLOADS_DIR, 'darwin-x64');
    mkdir('-p', dirPath);
    fs.writeFileSync(path.join(dirPath, 'extraterm-launcher'), exe);
  }

  if (process.platform === "win32") {
    const exe = await fetchUrl(`${baseUrl}/extraterm-launcher-windows.exe`);
    const windowPath = path.join(DOWNLOADS_DIR, 'win32-x64');
    mkdir('-p', windowPath);
    fs.writeFileSync(path.join(windowPath, 'extraterm-launcher.exe'), exe);
  }

// log(exe);
}

if (process.argv.length !== 2) {
  log("The version number should be passed as the first parameter to this script. i.e. v3");
  process.exit(1);
}

main(process.argv[1]);
