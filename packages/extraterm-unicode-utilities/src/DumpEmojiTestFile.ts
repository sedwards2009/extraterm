import * as fs from "fs";
import { isWide } from "./UnicodeUtilities";

const log = console.log.bind(console);


function main(): void {
  const codePoints = loadEmojiCodePointList();
  log("Narrow emoji");
  log("");
  log(formatCodePoints(codePoints.filter(cp => ! isWide(cp)), 6, " Narrow"));
  log("");
  log("Wide emoji");
  log("");
  log(formatCodePoints(codePoints.filter(cp => isWide(cp)), 4, " Wide"));
}

function formatCodePoints(codePoints: number[], codePointsPerLine: number, tail: string): string {
  const parts: string[] = [];
  const print = (text) => {
    parts.push(text);
  };

  let codePointCounter = codePointsPerLine;
  for (const codePoint of codePoints) {
    const c = String.fromCodePoint(codePoint);

    let codePointStr = codePoint.toString(16);
    codePointStr = codePointStr + " ".repeat(5-codePointStr.length);

    print(`${codePointStr} |${c}${c}${c}${c}${c}${c}${c}${c}|  `);

    codePointCounter--;
    if (codePointCounter === 0) {
      codePointCounter = codePointsPerLine;
      print(tail);
      print("\n");
    }
  }
  print("\n");

  return parts.join("");
}

function loadEmojiCodePointList(): number[] {
  const emojiCodePoints: number[] = [];

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
        emojiCodePoints.push(i);
      }
    } else {
      const codePoint = parseInt(codeRange, 16);
      emojiCodePoints.push(codePoint);
    }
  }
  return emojiCodePoints;
}

main();
