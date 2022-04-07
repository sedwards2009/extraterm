import * as fs from "fs";
import * as easta from "easta";
import { isWide } from "./UnicodeUtilities.js";

const log = console.log.bind(console);


function main(): void {
  const codePoints = loadEmojiCodePointList();
  sortCodePoints(codePoints);

  log("East Asian Width: Na=Narrow, F=Full Width, W=Wide, H=Half Width, A=Ambiuous, N=Neutral");
  log("");
  log("Narrow emoji");
  log("");
  log(formatCodePoints(codePoints.filter(cp => ! isWide(cp)), 5, " Narrow"));

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

    const ch = String.fromCodePoint(codePoint);
    let eaw = easta(ch);
    if (eaw.length === 1) {
      eaw = eaw + " ";
    }

    print(`${codePointStr} ${eaw} |${c}${c}${c}${c}${c}${c}${c}${c}|  `);

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
  const emojiCodePoints = new Set<number>();

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
        emojiCodePoints.add(i);
      }
    } else {
      const codePoint = parseInt(codeRange, 16);
      emojiCodePoints.add(codePoint);
    }
  }

  return Array.from(emojiCodePoints);
}

function sortCodePoints(codePoints: number[]): void {
  codePoints.sort( (a,b) => a === b ? 0 : (a <b ? -1 : 1));
}

main();
