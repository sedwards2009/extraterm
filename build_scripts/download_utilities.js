/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as https from 'node:https';

const log = console.log.bind(console);

/**
 * @param {string} url
 * @return {Promise<Buffer>}
 */
export async function fetchUrl(url) {
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
