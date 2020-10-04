/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require("fs");


function main() {
  echo("Downloading GitHub Emoji data file...");

  const result = exec('download https://api.github.com/emojis');
  const githubEmojis = JSON.parse(result);

  echo("Done downloading Emoji data.");
  const emojiTS = formatGithubEmojisTS(githubEmojis);

  fs.writeFileSync("src/EmojiData.ts", emojiTS, {encoding: "utf8"});
  echo("Done writing EmojiData.ts.");
}

function formatGithubEmojisTS(githubEmojis) {
  const lines = [];

  lines.push(`//-------------------------------------------------------------------------
// DO NOT EDIT
//
// This file is generated and updated by the "update-emoji-data" package script.
//-------------------------------------------------------------------------

export const emojiNames: string[] = [];
export const emojiCodePoints: number[] = [];
`);

  const EMOJI_URL_BASE = "https://github.githubassets.com/images/icons/emoji/unicode/";
  const EMOJI_URL_SUFFIX = ".png?v8";

  for (const key of Object.getOwnPropertyNames(githubEmojis)) {
    const value = githubEmojis[key];

    if ( ! value.startsWith(EMOJI_URL_BASE)) {
      continue;
    }
    if ( ! value.endsWith(EMOJI_URL_SUFFIX)) {
      continue;
    }
    const unicodeString = value.substring(EMOJI_URL_BASE.length, value.length-EMOJI_URL_SUFFIX.length);

    const parts = unicodeString.split(/-/g);
    if (parts.length !== 1) {
      continue;
    }
    const code = parts[0];

    lines.push(`emojiNames.push(String.fromCodePoint(0x${code}) + " ${key}");`);
    lines.push(`emojiCodePoints.push(0x${code});`);
  }

  return lines.join("\n");
}

main();
