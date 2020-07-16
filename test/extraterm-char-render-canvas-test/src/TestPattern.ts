import { CharCellGrid } from "extraterm-char-cell-grid";
import * as easta from "easta";


const COLOR_MODE_PALETTE = "palette";
const COLOR_MODE_RGB = "rgb";

function isFullWidth(ch: string): boolean {
  switch (easta(ch)) {
  	case 'Na': //Narrow
 	  return false;
  	case 'F': //FullWidth
  	  return true;
  	case 'W': // Wide
  	  return true;
  	case 'H': //HalfWidth
  	  return false;
  	case 'A': //Ambiguous
  	  return false;
  	case 'N': //Neutral
  	  return false;
  	default:
  	  return false;
  }
}

export interface OutputDevice {
  setForegroundRGB(rgb: [number, number, number]): void;
  setBackgroundRGB(rgb: [number, number, number]): void;
  setForegroundColorIndex(index: number): void;
  setBackgroundColorIndex(index: number): void;
  print(s: string): void;
  cr(): void;

  setBold(on: boolean): void;
  setUnderline(on: boolean): void;
  setItalic(on: boolean): void;
  setStrikethrough(on: boolean): void;
  setExtraFont(on: boolean): void;

  reset(): void;
}

export class VtOutputDevice implements OutputDevice {

  private _lineBuffer = "";

  private fgColorMode = COLOR_MODE_PALETTE;
  private bgColorMode = COLOR_MODE_PALETTE;
  private fgIndex = 7;
  private bgIndex = 0;
  private fgRGB = [255,255,255];
  private bgRGB = [0, 0, 0];

  private fgR = 0;
  private fgG = 0;
  private fgB = 0;

  private bgR = 0;
  private bgG = 0;
  private bgB = 0;

  constructor() {
    this._resetState();
    this.reset();
  }

  _resetState() {
    this.fgColorMode = COLOR_MODE_PALETTE;
    this.bgColorMode = COLOR_MODE_PALETTE;

    this.fgIndex = 7;
    this.bgIndex = 0;

    this.fgRGB = [255,255,255];
    this.bgRGB = [0, 0, 0];
  }

  setForegroundRGB(rgb: [number, number, number]): void {
    if (this.fgColorMode !== COLOR_MODE_RGB || this.fgR !== rgb[0] || this.fgG !== rgb[1] || this.fgB !== rgb[2]) {
      this._lineBuffer += `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
      this.fgColorMode = COLOR_MODE_RGB;
      this.fgRGB = rgb;
    }
  }

  setBackgroundRGB(rgb: [number, number, number]): void {
    if (this.bgColorMode !== COLOR_MODE_RGB || this.bgR !== rgb[0] || this.bgG !== rgb[1] || this.bgB !== rgb[2]) {
      this._lineBuffer += `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
      this.bgColorMode = COLOR_MODE_RGB;
      this.bgRGB = rgb;
    }
  }

  setForegroundColorIndex(index) {
    if (this.fgColorMode !== COLOR_MODE_PALETTE || this.fgIndex !== index) {
      this._lineBuffer += `\x1b[38;5;${index}m`;
      this.fgColorMode = COLOR_MODE_PALETTE;
      this.fgIndex = index;
    }
  }

  setBackgroundColorIndex(index: number): void {
    if (this.bgColorMode !== COLOR_MODE_PALETTE || this.bgIndex !== index) {
      this._lineBuffer += `\x1b[48;5;${index}m`;
      this.bgColorMode = COLOR_MODE_PALETTE;
      this.bgIndex = index;
    }
  }

  setExtraFont(on: boolean): void {}

  print(s: string): void {
    this._lineBuffer += s;
  }

  cr(): void {
    console.log(this._lineBuffer);
    this._lineBuffer = "";
  }

  reset(): void {
    this._resetState();
    this._lineBuffer += "\x1b[0m";
  }

  flush(): void {
    this.cr();
  }

  setBold(on) {
    if (on) {
      this._lineBuffer += "\x1b[1m";
    } else {
      this._lineBuffer += "\x1b[22m";
    }
  }

  setUnderline(on) {
    if (on) {
      this._lineBuffer += "\x1b[4m";
    } else {
      this._lineBuffer += "\x1b[24m";
    }
  }

  setItalic(on) {
    if (on) {
      this._lineBuffer += "\x1b[3m";
    } else {
      this._lineBuffer += "\x1b[23m";
    }
  }

  setStrikethrough(on) {
    if (on) {
      this._lineBuffer += "\x1b[9m";
    } else {
      this._lineBuffer += "\x1b[29m";
    }
  }
}

const STYLE_MASK_BOLD = 1;
const STYLE_MASK_UNDERLINE = 2;
const STYLE_MASK_ITALIC = 4;
const STYLE_MASK_STRIKETHROUGH = 8;

export class CellGridOutputDevice implements OutputDevice {
  private x = 0;
  private y = 0;
  private isBold = false;
  private isItalic = false;
  private isUnderline = false;
  private isStrikethrough = false;
  private isExtraFont = false;

  private fgRGB: [number, number, number] = [255,255,255];
  private bgRGB: [number, number, number] = [0, 0, 0];

  private fgIndex = 7;
  private bgIndex = 0;
  private fgColorMode = COLOR_MODE_PALETTE;
  private bgColorMode = COLOR_MODE_PALETTE;

  constructor(public cellGrid: CharCellGrid) {
    this._resetState();
  }

  _resetState() {
    this.fgRGB = [255,255,255];
    this.bgRGB = [0, 0, 0];

    this.fgIndex = 7;
    this.bgIndex = 0;

    this.fgColorMode = COLOR_MODE_PALETTE;
    this.bgColorMode = COLOR_MODE_PALETTE;
  }

  setForegroundRGB(rgb: [number, number, number]): void {
    this.fgColorMode = COLOR_MODE_RGB;
    this.fgRGB = rgb;
  }

  setBackgroundRGB(rgb: [number, number, number]): void {
    this.bgColorMode = COLOR_MODE_RGB;
    this.bgRGB = rgb;
  }

  setForegroundColorIndex(index: number): void {
    this.fgColorMode = COLOR_MODE_PALETTE;
    this.fgIndex = index;
  }

  setBackgroundColorIndex(index: number): void {
    this.bgColorMode = COLOR_MODE_PALETTE;
    this.bgIndex = index;
  }

  setExtraFont(on: boolean): void {
    this.isExtraFont = on;
  }

  print(s: string): void {
    for (let i=0; i<s.length; i++) {
      const codePoint = s.codePointAt(i);
      if (codePoint > 0x010000) { // Skip UTF-16 surrogate pair
        i++;
      }

      this.cellGrid.setCodePoint(this.x, this.y, codePoint);

      let style = 0;
      if (this.isBold) {
        style |= STYLE_MASK_BOLD;
      }
      if (this.isItalic) {
        style |= STYLE_MASK_ITALIC;
      }
      if (this.isUnderline) {
        style |= STYLE_MASK_UNDERLINE;
      }
      if (this.isStrikethrough) {
        style |= STYLE_MASK_STRIKETHROUGH;
      }
      this.cellGrid.setStyle(this.x, this.y, style);

      this.cellGrid.setExtraFontsFlag(this.x, this.y, this.isExtraFont);

      if (this.fgColorMode === COLOR_MODE_PALETTE) {
        this.cellGrid.setFgClutIndex(this.x, this.y, this.fgIndex);
      } else {
        this.cellGrid.setFgRGBA(this.x, this.y, this._packRGBA(this.fgRGB));
      }

      if (this.bgColorMode === COLOR_MODE_PALETTE) {
        this.cellGrid.setBgClutIndex(this.x, this.y, this.bgIndex);
      } else {
        this.cellGrid.setBgRGBA(this.x, this.y, this._packRGBA(this.bgRGB));
      }
      this.x++;
      if (isFullWidth(s.charAt(i)) || codePoint > 0x010000) {
        this.x++;
      }
    }
  }

  _packRGBA(rgbTuple: [number, number, number]): number {
    return (rgbTuple[0]|0) << 24 | (rgbTuple[1]|0) << 16 | (rgbTuple[2]|0) << 8 | 0xff;
  }

  cr(): void {
    this.x = 0;
    this.y++;
  }

  reset(): void {
    this._resetState();
  }

  flush(): void {
  }

  setBold(on: boolean): void {
    this.isBold = on;
  }

  setUnderline(on: boolean): void {
    this.isUnderline = on;
  }

  setItalic(on: boolean): void {
    this.isItalic = on;
  }

  setStrikethrough(on: boolean): void {
    this.isStrikethrough = on;
  }
}

export function printTestPattern(output: OutputDevice): void {
  printPalette(output);
  output.cr();

  output.print("Checkerboard");
  output.cr();
  printCheckerboardPattern(output, 3);
  output.cr();

  printRgbGradientPattern(output);
  output.cr();

  printCJK(output);
  output.cr();

  printStyles(output);
  output.cr();

  output.print("Emoji");
  output.cr();
  printEmoji(output);
  output.cr();

  output.print("Strange dimension chars");
  output.cr();
  printBigChars(output);
  output.cr();
}

export function printCheckerboardPattern(output: OutputDevice, rows: number): void {
  const checkerPatternFunc = (x, y) => {
    if ((x % 2) !== (y % 2)) {
      return [255, 255, 255];
    } else {
      return [0, 0, 0];
    }
  };

  const negCheckerPatternFunc = (x, y) => {
    return checkerPatternFunc(x+1, y);
  };

  printAlphabet(output, rows, checkerPatternFunc, negCheckerPatternFunc);
}

const ALPHABET_COLS = 30;

function printAlphabet(output: OutputDevice, rows: number, fgFunc, bgFunc) {
  for (let j=0; j<rows; j++) {
    for (let i="!".codePointAt(0),x=0; i<"~".codePointAt(0); i++,x++) {
      output.setForegroundRGB(fgFunc(x, j));
      output.setBackgroundRGB(bgFunc(x, j));
      output.print(String.fromCodePoint(i));
    }

    output.reset();
    output.cr();
  }
}

export function printRgbGradientPattern(output: OutputDevice) {
  output.print("RGB");
  output.cr();

  const gradientPatternFunc = (x, y) => {
    const red = [255, 0, 0];
    const green = [0, 255, 0];
    const blue = [0, 0, 255];
    const baseColor = [red, green, blue][y];

    return [Math.floor((x/ALPHABET_COLS % 1) * baseColor[0]),
            Math.floor((x/ALPHABET_COLS % 1) * baseColor[1]),
            Math.floor((x/ALPHABET_COLS % 1) * baseColor[2])];
  };

  const whiteFunc = (x, y) => {
    return [255, 255, 255];
  };

  printAlphabet(output, 3, whiteFunc, gradientPatternFunc);
}

export function printPalette(output: OutputDevice): void {
  output.print("8bit palette");
  output.cr();
  let i=0;
  while (i < 256) {

    output.setForegroundColorIndex(7);
    for (let j=0; j<32; j++) {
      const index = i + j;
      output.setBackgroundColorIndex(index);
      const pre = "   ".slice(0, -("" + index).length);
      output.print(pre + index + " ");
    }
    output.setForegroundColorIndex(7);
    output.setBackgroundColorIndex(0);
    output.reset();
    output.cr();

    for (let j=0; j<32; j++) {
      const index = i + j;
      output.setForegroundColorIndex(index);
      const pre = "   ".slice(0, -("" + index).length);
      output.print(pre + index + " ");
    }

    output.setForegroundColorIndex(7);
    output.setBackgroundColorIndex(0);
    output.reset();
    output.cr();

    i += 32;
  }
}

export function printCJK(output: OutputDevice): void {
  output.print("  ┌──────┬──────┰──────┐  ┏━━━━━━┳━━━━━━┯━━━━━━┓");
  output.cr();
  output.print("  │ ABCD │ ABCD ┃ ABCD │  ┃ ABCD ┃ ABCD │ ABCD ┃");
  output.cr();
  output.print("  ├──────┼──────╂──────┤  ┣━━━━━━╋━━━━━━┿━━━━━━┫");
  output.cr();
  output.print("  │ 漢字 │ 漢字 ┃ 漢字 │  ┃ 漢字 ┃ 漢字 │ 漢字 ┃");
  output.cr();
  output.print("  ┝━━━━━━┿━━━━━━╋━━━━━━┥  ┠──────╂──────┼──────┨");
  output.cr();
  output.print("  │ ABCD │ ABCD ┃ ABCD │  ┃ ABCD ┃ ABCD │ ABCD ┃");
  output.cr();
  output.print("  └──────┴──────┸──────┘  ┗━━━━━━┻━━━━━━┷━━━━━━┛");
  output.cr();
}

export function printStyles(output: OutputDevice): void {
  output.print("Bold");
  output.cr();
  output.setBold(true);
  output.print("0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}");
  output.cr();
  printCheckerboardPattern(output, 1);
  output.setBold(false);
  output.reset();
  output.cr();

  output.print("Underline");
  output.cr();
  output.setUnderline(true);
  output.print("0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}");
  output.cr();
  printCheckerboardPattern(output, 1);
  output.setUnderline(false);
  output.reset();
  output.cr();

  output.print("Italic");
  output.cr();
  output.setItalic(true);
  output.print("0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}");
  output.cr();
  printCheckerboardPattern(output, 1);
  output.setItalic(false);
  output.reset();
  output.cr();

  output.print("Strikethrough");
  output.cr();
  output.setStrikethrough(true);
  output.print("0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}");
  output.cr();
  printCheckerboardPattern(output, 1);
  output.setStrikethrough(false);
  output.reset();
  output.cr();
}

export function printEmoji(output: OutputDevice): void {
  output.setBackgroundColorIndex(3);
  output.print("X123456X");
  output.reset();
  output.cr();
  output.reset();

  output.print("X");
  output.setExtraFont(true);
  output.print("😀🍺🚀");
  output.setExtraFont(false);
  output.print("X");
  output.cr();

  output.setBackgroundColorIndex(3);
  output.print("X123456X");
  output.reset();
  output.cr();

}

export function printBigChars(output: OutputDevice): void {
  output.setBackgroundColorIndex(4);
  output.print("X12345667890X");
  output.reset();
  output.cr();

  const bigString = "X(){}\u00C5\u00E7\u014A\u013B\u0141\u0126┃X";
  output.print(bigString);
  output.reset();
  output.cr();

  output.setForegroundRGB([0x00, 0x00, 0x00]);
  output.setBackgroundRGB([0xb0, 0xb0, 0xb0]);
  output.print("                           ");
  output.reset();
  output.cr();

  for (let i=0; i<bigString.length; i++) {
    if ((i % 2) === 0) {
      output.setForegroundRGB([0xff, 0xff, 0xff]);
      output.setBackgroundRGB([0x00, 0x00, 0x00]);
    } else {
      output.setForegroundRGB([0x00, 0x00, 0x00]);
      output.setBackgroundRGB([0xb0, 0xb0, 0xb0]);
    }
    output.print(bigString.charAt(i));
  }
  output.reset();
  output.cr();

  output.setForegroundRGB([0x00, 0x00, 0x00]);
  output.setBackgroundRGB([0xb0, 0xb0, 0xb0]);
  output.print("                           ");
  output.reset();
  output.cr();


  output.setBackgroundColorIndex(3);
  output.print("X12345667890X");
  output.reset();
  output.cr();
}
