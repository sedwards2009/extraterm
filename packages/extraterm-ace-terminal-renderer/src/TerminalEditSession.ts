import { Document,
         EditSession,
         HighlighterToken,
         TokenWithIndex,
         Delta,
         Fold,
         LanguageMode,
         TextMode, RangeBasic } from "ace-ts";

import * as TermApi from "term-api";
import * as LineFunctions from "./LineFunctions";
import { STYLE_MASK_BOLD, STYLE_MASK_UNDERLINE, STYLE_MASK_BLINK, STYLE_MASK_INVERSE, STYLE_MASK_INVISIBLE, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_FAINT, CharCellGrid, STYLE_MASK_CURSOR } from "extraterm-char-cell-grid";


const OVERSIZE_CLASSES = "oversize";
const defaultCellAttr = TermApi.packAttr(0, 257, 256);


export class TerminalEditSession extends EditSession {

  private _lineData: TermApi.OldLine[] = [];

  constructor(doc: string | Document, mode: LanguageMode = new TextMode(), callback?) {
    super(doc, mode, callback);
    this._initializeLineAttributes();
  }

  getState(row: number): string {
    return "";
  }

  /**
   * 
   * @return True if the text changed.
   */
  setTerminalLine(row: number, newSourceLine: TermApi.Line): boolean {
    const sourceLine = convertNewLineToOldLine(newSourceLine);

    const line = this._trimRightWhitespace(sourceLine);
    const range: RangeBasic = {
      start: {
        row,
        column: 0
      },
      end: {
        row,
        column: this.getLine(row).length
      }
    };

    const newText = String.fromCodePoint(...line.chars);
    const oldText = this.getLine(row);
    if (newText !== oldText) {
      this.replace(range, newText);
      this._lineData[row] = line;
      return true;
    } else {
      this._lineData[row] = line;
      return false;
    }
  }

  getTerminalLine(row: number): TermApi.Line {
     const oldLine: TermApi.OldLine = {
      attrs: new Uint32Array(this._lineData[row].attrs),
      chars: LineFunctions.stringToCodePointArray(this.getLine(row))
    };
    return convertOldLineToNewLine(oldLine);
  }

  private _trimRightWhitespace(sourceLine: TermApi.OldLine): TermApi.OldLine {
    let lineLength = sourceLine.chars.length;
    const spaceCodePoint = ' '.codePointAt(0);
    const attrs = sourceLine.attrs;
    const uint32Chars = sourceLine.chars;
    
    // Trim off any unstyled whitespace to the right of the line.
    while (lineLength !==0 && attrs[lineLength-1] === defaultCellAttr && uint32Chars[lineLength-1] === spaceCodePoint) {
      lineLength--;
    }

    return {
      chars: sourceLine.chars.slice(0, lineLength),
      attrs: sourceLine.attrs.slice(0, lineLength)
    };
  }

  appendTerminalLine(newSourceLine: TermApi.Line): void {
    const sourceLine = convertNewLineToOldLine(newSourceLine);

    const line = this._trimRightWhitespace(sourceLine);
    const rowCount = this.getLength();
    const range: RangeBasic = {
      start: {
        row: rowCount-1,
        column: this.getLine(rowCount-1).length
      },
      end: {
        row: rowCount,
        column: 0
      }
    };

    const newText = String.fromCodePoint(...line.chars);
    const lineDataLen = this._lineData.length;
    this.replace(range,"\n" + newText);
    this._lineData[lineDataLen] = line;
  }

  insertTerminalLine(row: number, newSourceLine: TermApi.Line): void {
    const sourceLine = convertNewLineToOldLine(newSourceLine);
    const line = this._trimRightWhitespace(sourceLine);
    const rowCount = this.getLength();
    const range: RangeBasic = {
      start: {
        row,
        column: 0
      },
      end: {
        row,
        column: 0
      }
    };

    const newText = String.fromCodePoint(...line.chars);
    this.replace(range, newText + "\n");
    this._lineData[row] = line;
  }

  private _initializeLineAttributes(): void {
    const numberOfRows = this.doc.getLength();
    for (let i=0; i<numberOfRows; i++) {
      this._lineData.push(LineFunctions.create(this.getLine(i).length));
    }
  }

  getTokens(row: number): HighlighterToken[] {
    const lineCellAttrs = this._lineData[row] == null ? null : this._lineData[row].attrs;
    const tokens: HighlighterToken[] = [];
    const text = this.doc.getLine(row);
    const lineLength = text.length;
    const normalWidthCodePointCutOff = maxNormalWidthCodePoint();

    let currentCellAttr = defaultCellAttr;
    let spanStart = 0;
    let cellAttrIndex = 0;
    let charIndex = 0;
    let outputOversize = false;

    while (charIndex < lineLength) {
      let codePoint: number;
      if (isFirstSurogate(text[charIndex])) {
        codePoint = text.substr(charIndex,2).codePointAt(0);
      } else {
        codePoint = text[charIndex].codePointAt(0);
      }

      const oversizeCodePoint = codePoint > normalWidthCodePointCutOff && isCodePointNormalWidth(codePoint) === false;

      const iCellAttr = lineCellAttrs == null ? defaultCellAttr : lineCellAttrs[cellAttrIndex];
      if (iCellAttr !== currentCellAttr || oversizeCodePoint || outputOversize) {
        if (charIndex !== 0 && spanStart !== charIndex) {
          // This is the end of a token. Add it to the list.
          const classList = " " + this._cellAttrToClasses(currentCellAttr).join(" ") + (outputOversize ? " " + OVERSIZE_CLASSES : "");
          tokens.push({type: classList, value: text.slice(spanStart, charIndex)});
          spanStart = charIndex;
        }
        outputOversize = oversizeCodePoint;
      }
      currentCellAttr = iCellAttr;
    
      charIndex++;
      if (codePoint >= 0x10000) {
        // Must have been part of a surogate pair. Skip the pair.
        charIndex++;
      }
      cellAttrIndex++
    }

    if (spanStart !== charIndex) {
      tokens.push({type: " " + this._cellAttrToClasses(currentCellAttr).join(" "), value: text.slice(spanStart)});
    }

    return tokens;
  }

  private _cellAttrToClasses(cellAttr: number): string[] {
    const classList = [];
    if (cellAttr === 0xffffffff) {
      // Cursor itself
      classList.push("reverse-video");
      classList.push("terminal-cursor");
    } else {
    
      let bg = TermApi.backgroundFromCharAttr(cellAttr);
      let fg = TermApi.foregroundFromCharAttr(cellAttr);
      const flags = TermApi.flagsFromCharAttr(cellAttr);
      
      // bold
      if (flags & TermApi.BOLD_ATTR_FLAG) {
        classList.push('terminal-bold');

        // See: XTerm*boldColors
        if (fg < 8) {
          fg += 8;  // Use the bright version of the color.
        }
      }

      // italic
      if (flags & TermApi.ITALIC_ATTR_FLAG) {
        classList.push('terminal-italic');
      }
      
      // underline
      if (flags & TermApi.UNDERLINE_ATTR_FLAG) {
        classList.push('terminal-underline');
      }

      // strike through
      if (flags & TermApi.STRIKE_THROUGH_ATTR_FLAG) { 
        classList.push('terminal-strikethrough');
      }
      
      // inverse
      if (flags & TermApi.INVERSE_ATTR_FLAG) {
        let tmp = fg;
        fg = bg;
        bg = tmp;
        
        // Should inverse just be before the
        // above boldColors effect instead?
        if ((flags & TermApi.BOLD_ATTR_FLAG) && fg < 8) {
          fg += 8;  // Use the bright version of the color.
        }
      }

      // invisible
      if (flags & TermApi.INVISIBLE_ATTR_FLAG) {
        classList.push('terminal-invisible');
      }

      if (bg !== 256) {
        classList.push('terminal-background-' + bg);
      }

      if (flags & TermApi.FAINT_ATTR_FLAG) {
        classList.push('terminal-faint-' + fg);
      } else {
        if (fg !== 257) {
          classList.push('terminal-foreground-' + fg);
        }
      }
      
      if (flags & TermApi.BLINK_ATTR_FLAG) {
        classList.push("terminal-blink");
      }
    }
    return classList;
  }

  protected _updateInternalDataOnChange(delta: Delta): Fold[] {
    const folds = super._updateInternalDataOnChange(delta);

    if (delta.action === "insert") {
      this._updateDeltaInsert(delta);
    } else {
      this._updateDeltaRemove(delta);
    }

    return folds;
  }

  private _getLineData(row: number): TermApi.OldLine {
    let data = this._lineData[row];
    if (data == null) {
      const text = this.getLine(row);
      data = LineFunctions.create(text.length);
      this._lineData[row] = data;
    }
    return data;
  }

  private _updateDeltaInsert(delta: Delta): void {
    const lineData = this._getLineData(delta.start.row);

    if (delta.lines.length == 1) {
      LineFunctions.insertSpaces(lineData, delta.start.column, delta.lines[0].length);
    } else {

      // Start row
      const endRowAttr = LineFunctions.split(lineData, delta.start.column);
      LineFunctions.insertSpaces(lineData, delta.start.column, delta.lines[0].length);

      // Middle rows
      if (delta.lines.length > 2) {
        const middleLast = delta.lines.length-1;
        const middleRows: TermApi.OldLine[] = [];
        for (let i=1; i<middleLast; i++) {
          middleRows.push(LineFunctions.create(delta.lines[i].length));
        }
        this._lineData.splice.apply(this._lineData, [delta.start.row+1, 0, ...middleRows]);
      }

      // End row
      LineFunctions.insertSpaces(endRowAttr, 0, delta.lines[delta.lines.length-1].length);
      this._lineData.splice(delta.start.row + delta.lines.length-1, 0, endRowAttr);
    }
  }

  private _updateDeltaRemove(delta: Delta): void {
    const startRow = delta.start.row;
    const endColumn = delta.end.column;
    const endRow = delta.end.row;
    if (startRow === endRow) {
      LineFunctions.cut(this._getLineData(startRow), delta.start.column, endColumn);
    } else {
      const startRowLine = this._getLineData(startRow);
      LineFunctions.cut(startRowLine, delta.start.column);
      const endRowLine = this._getLineData(delta.end.row);
      LineFunctions.cut(endRowLine, 0, delta.end.column);
      LineFunctions.insert(startRowLine, startRowLine.attrs.length, endRowLine);
      if (delta.lines.length > 1) {
        this._lineData.splice(delta.start.row+1, delta.lines.length-1);
      }
    }
  }
}

function maxNormalWidthCodePoint(): number {
  return 0x01c3;  // Last char before the Croatian digraphs. DejaVuSansMono has some extra wide chars after this.
}

/**
 * Return true if a code point has a normal monospace width of one cell.
 * 
 * @param the unicode code point to test
 * @return true if the code point has a normal monospace width of one cell.
 */
function isCodePointNormalWidth(codePoint: number): boolean {
  if (codePoint < 0x01c4) { // Latin up to the Croatian digraphs.
    return true;
  }

  if (codePoint <= 0x1cc) {// Croatian digraphs can be a problem.
    return false; 
  }

  if (codePoint < 0x1f1) {  // Up to Latin leter DZ.
    return true;
  }
  if (codePoint <= 0x1f3) { // Latin letter DZ.
    return false;
  }

  return false;
}

function isFirstSurogate(s: string): boolean {
  const codePoint = s.codePointAt(0);
  return (codePoint & 0xFC00) == 0xD800;
}

function convertNewLineToOldLine(newLine: TermApi.Line): TermApi.OldLine {
  const width = newLine.width;
  const oldLine = LineFunctions.create(width);
  oldLine.chars = new Uint32Array(width);

  for (let i=0; i<width; i++) {
    oldLine.chars[i] = newLine.getCodePoint(i, 0);
    const style = newLine.getStyle(i, 0);
    let flags= 0;

    if (style & STYLE_MASK_BOLD) {
      flags |= TermApi.BOLD_ATTR_FLAG;
    }
    if (style & STYLE_MASK_UNDERLINE) {
      flags |= TermApi.UNDERLINE_ATTR_FLAG;
    }
    if (style & STYLE_MASK_BLINK) {
      flags |= TermApi.BLINK_ATTR_FLAG;
    }
    if (style & STYLE_MASK_INVERSE) {
      flags |= TermApi.INVERSE_ATTR_FLAG;
    }
    if (style & STYLE_MASK_INVISIBLE) {
      flags |= TermApi.INVISIBLE_ATTR_FLAG;
    }
    if (style & STYLE_MASK_ITALIC) {
      flags |= TermApi.ITALIC_ATTR_FLAG;
    }
    if (style & STYLE_MASK_STRIKETHROUGH) {
      flags |= TermApi.STRIKE_THROUGH_ATTR_FLAG;
    }
    if (style & STYLE_MASK_FAINT) {
      flags |= TermApi.FAINT_ATTR_FLAG;
    }

    if (style & STYLE_MASK_CURSOR) {
      oldLine.attrs[i] = 0xffffffff;
    } else {
      oldLine.attrs[i] = TermApi.packAttr(flags, newLine.getFgClutIndex(i, 0), newLine.getBgClutIndex(i, 0));
    }
  }

  return oldLine;
}

function convertOldLineToNewLine(oldLine: TermApi.OldLine): TermApi.Line {
  const attrs = oldLine.attrs;
  const width = attrs.length;
  const codePoints = oldLine.chars;
  const newLine = new CharCellGrid(width, 1);
  for (let i=0; i<width; i++) {
    newLine.setCodePoint(i, 0, codePoints[i]);

    const attr = attrs[i];

    const flags = TermApi.flagsFromCharAttr(attr);
    const fgClutIndex = TermApi.foregroundFromCharAttr(attr);
    const bgClutIndex = TermApi.backgroundFromCharAttr(attr);
    let style = 0;
    
    if (flags & TermApi.BOLD_ATTR_FLAG) {
      style |= STYLE_MASK_BOLD;
    }
    if (flags & TermApi.UNDERLINE_ATTR_FLAG) {
      style |= STYLE_MASK_UNDERLINE;
    }
    if (flags & TermApi.BLINK_ATTR_FLAG) {
      style |= STYLE_MASK_BLINK;
    }
    if (flags & TermApi.INVERSE_ATTR_FLAG) {
      style |= STYLE_MASK_INVERSE;
    }
    if (flags & TermApi.INVISIBLE_ATTR_FLAG) {
      style |= STYLE_MASK_INVISIBLE;
    }
    if (flags & TermApi.ITALIC_ATTR_FLAG) {
      style |= STYLE_MASK_ITALIC;
    }
    if (flags & TermApi.STRIKE_THROUGH_ATTR_FLAG) {
      style |= STYLE_MASK_STRIKETHROUGH;
    }
    if (flags & TermApi.FAINT_ATTR_FLAG) {
      style |= STYLE_MASK_FAINT;
    }

    if (flags == 0xffffff) {
      newLine.setStyle(i, 0, STYLE_MASK_CURSOR);
    } else {
      newLine.setStyle(i, 0, style);
    }

    newLine.setFgClutIndex(i, 0, fgClutIndex);
    newLine.setBgClutIndex(i, 0, bgClutIndex);
  }

// TODO convert styles

  return newLine;
}
