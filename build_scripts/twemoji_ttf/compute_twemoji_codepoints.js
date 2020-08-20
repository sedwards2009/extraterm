/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 * 
 */
/**
 * Get the list of emoji code points (no combining chars though) which a tag on
 * the Twemoji git repository supports. The list is printed out.
 */
const TAG = "v13.0.1";


const https = require('https');

const log = console.log.bind(console);

async function main() {

  const tagSHA1 = await fetchSHA1ForTag(TAG);
  const assetsSHA1 = await fetchSHA1ForPathComponent(tagSHA1, "assets");
  const seven2x72SHA1 = await fetchSHA1ForPathComponent(assetsSHA1, "72x72");
  const contents = await fetchUrl(`https://api.github.com/repos/twitter/twemoji/git/trees/${seven2x72SHA1}`);

  const codePoints = extractCodePointsFromJson(contents);
  sortCodePoints(codePoints);

  dumpCodePoints(codePoints);
}

async function fetchSHA1ForTag(tag) {
  log(`Fetching SHA1 for tag ${tag}`);
  const contents = await fetchUrl(`https://api.github.com/repos/twitter/twemoji/tags`);

  for (const item of contents) {
    if (item.name === tag) {
      const sha1 = item.commit.sha;
      log(`  found ${sha1}`);
      return sha1;
    }
  }
  log(`  found nothing :-(`);
  return null;
}

async function fetchSHA1ForPathComponent(baseSHA1, component) {
  log(`Fetching SHA1 for '${component}'`);
  const contents = await fetchUrl(`https://api.github.com/repos/twitter/twemoji/git/trees/${baseSHA1}`);
// log(contents);
  for (const item of contents.tree) {
    if (item.path === component) {
      const sha1 = item.sha;
      log(`  found ${sha1}`);
      return sha1;
    }
  }

  log(`  found nothing :-(`);
  return null;
}

async function fetchUrl(url) {
  return new Promise( (resolve, reject) => {
    https.get(url, {headers: {"User-Agent": "extraterm-twemoji-codepoint-thingy"}}, (resp) => {
      // log(resp.headers);

      let data = '';
      resp.on('data', (chunk) => {
        data += chunk;
      });

      resp.on('end', () => {
        resolve(JSON.parse(data));
      });
    }).on("error", (err) => {
      log("Error: " + err.message);
      reject("Error: " + err.message);
    });
  });
}

function extractCodePointsFromJson(contents) {
  const fileNames = [];
  for (const item of contents.tree) {
    if (item.type !== "blob") {
      continue;
    }
    fileNames.push(item.path);
  }

  const codePoints = [];
  for (const fileName of fileNames) {
    if (fileName.includes("-")) {
      continue;
    }
    const codePoint = parseInt(fileName.substring(0, fileName.length-4), 16);
    codePoints.push(codePoint);
  }

  return codePoints;
}

function sortCodePoints(codePoints) {
  codePoints.sort( (a,b) => a === b ? 0 : (a <b ? -1 : 1));
}

function dumpCodePoints(codePoints) {
  const parts = [];
  parts.push(`[\n`);
  let i=0;
  for (const codePoint of codePoints) {
    parts.push(`0x${codePoint.toString(16)}, `);
    i++;
    if (i % 10 === 0) {
      parts.push("\n");
    }
  }
  parts.push(`];\n`);

  log(parts.join(""));
}

main();
