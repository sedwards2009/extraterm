/**
 *
 */

const fs = require("fs");

const log = console.log.bind(console);

const emojiMap = new Map();  // Map<number, {emoji: boolean, emojiPresentation: boolean } >

function main() {

  loadEmojiData();
  dumpEmojiWidths();
  // dumpEmojiTestFile();
}

function loadEmojiData() {
  const emojiDataFile = fs.readFileSync("build_scripts/emoji-data.txt", {encoding: "utf8"});
  const lines = emojiDataFile.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    const parts = line.split(" ").filter(p => p !== "");

    const codeRange = parts[0];
    if (codeRange.indexOf("..")) {
      const rangeParts = codeRange.split("..");
      const startRange = parseInt(rangeParts[0], 16);
      const endRange = parseInt(rangeParts[1], 16);
      for (let i=startRange; i<=endRange; i++) {
        markCodePoint(i, parts[2]);
      }
    } else {
      const codePoint = parseInt(codeRange, 16);
      markCodePoint(codePoint, parts[2]);
    }
  }
}

function markCodePoint(codePoint, property) {
  let codePointData = emojiMap.get(codePoint);
  if (codePointData == null) {
    codePointData = {
      emoji: false,
      emojiPresentation: false
    };
    emojiMap.set(codePoint, codePointData);
  }

  if (property === "Emoji") {
    codePointData.emoji = true;
  }
  if (property === "Emoji_Presentation") {
    codePointData.emojiPresentation = true;
  }
}

function dumpEmojiWidths() {
  const wideCodePoints = getWideCodePoints();
  const ranges = codePointsToRanges(wideCodePoints);
  dumpRanges(ranges);
}

function getWideCodePoints() {
  const wideCodePoints = [];
  for (const [key, value] of emojiMap) {
    if (value.emoji && value.emojiPresentation) {
      wideCodePoints.push(key);
    }
  }
  wideCodePoints.sort( (a,b) => a === b ? 0 : (a <b ? -1 : 1));
  return wideCodePoints;
}

function codePointsToRanges(codePoints) {
  let rangeStart = codePoints[0];
  let rangeEnd = codePoints[0];

  const ranges = [];

  for (let i=1; i<codePoints.length; i++) {
    const nextCodePoint = codePoints[i];
    if (nextCodePoint === rangeEnd+1) {
      rangeEnd++;
    } else {
      ranges.push({
        start: rangeStart,
        end: rangeEnd
      });
      rangeStart = nextCodePoint;
      rangeEnd = rangeStart;
    }
  }

  ranges.push({
    start: rangeStart,
    end: rangeEnd
  });

  return ranges;
}

function dumpRanges(ranges) {
  log(`const wideEmojiRanges = new Uint32Array([`);
  for (const range of ranges) {
    log(`  0x${range.start.toString(16)}, 0x${range.end.toString(16)},`);
  }
  log(`]);`);
  log(`exports.wideEmojiRanges = wideEmojiRanges;`);
}

function dumpEmojiTestFile() {
  const narrowCodePoints = getNarrowCodePoints();
  log("Narrow Emoji");
  for (const codePoint of narrowCodePoints) {
    const c = String.fromCodePoint(codePoint);
    log(`|${c}${c}${c}${c}${c}${c}${c}${c}| Narrow`);
  }

  const wideCodePoints = getWideCodePoints();
  log("");
  log("Wide Emoji");
  for (const codePoint of wideCodePoints) {
    const c = String.fromCodePoint(codePoint);
    log(`|${c}${c}${c}${c}| Wide`);
  }
}

function getNarrowCodePoints() {
  const narrowCodePoints = [];
  for (const [key, value] of emojiMap) {
    if (!(value.emoji && value.emojiPresentation)) {
      narrowCodePoints.push(key);
    }
  }
  narrowCodePoints.sort( (a,b) => a === b ? 0 : (a <b ? -1 : 1));
  return narrowCodePoints;
}



main();
