import { Document } from "ace-ts/build/Document";
import { EditSession } from "ace-ts/build/EditSession";
import { HighlighterToken } from "ace-ts/build/mode/Highlighter";
import { TokenWithIndex } from "ace-ts/build/Token";
import { RowAttributes } from "./RowAttributes";
import { Delta } from "ace-ts/build/Delta";
import { Fold } from "ace-ts/build/Fold";
import { LanguageMode } from "ace-ts/build/LanguageMode";
import { TextMode } from "ace-ts/build/mode/TextMode";

import * as TermApi from "term-api";
import { RangeBasic } from "ace-ts/build/RangeBasic";


const OVERSIZE_CLASSES = "oversize";


export class TerminalEditSession extends EditSession {

  private _rowAttributesList: RowAttributes[] = [];
  private _lineData: TermApi.Line[] = [];

  constructor(doc: string | Document, mode: LanguageMode = new TextMode(), callback?) {
    super(doc, mode, callback);
    this._initializeRowAttributes();
    this._initializeLineAttributes();
  }

  setTerminalLine(row: number, line: TermApi.Line): void {
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
    this._lineData[row] = line;
    this.replace(range, newText);
  }

  appendTerminalLine(line: TermApi.Line): void {
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
    this._lineData.push(line);
    this.replace(range,"\n" + newText);
  }

  private _initializeRowAttributes(): void {
    const numberOfRows = this.doc.getLength();
    for (let i=0; i<numberOfRows; i++) {
      const line = this.doc.getLine(i);
      this._rowAttributesList.push(new RowAttributes(line.length));
    }

  }

  private _initializeLineAttributes(): void {
    const numberOfRows = this.doc.getLength();
    for (let i=0; i<numberOfRows; i++) {
      this._lineData.push(null);
    }
  }

  __getTokens(row: number): HighlighterToken[] {

    console.log("new style tokens: ", this.__getTokens(row));


    const ra = this._rowAttributesList[row]
    const rowText = this.doc.getLine(row);
    return ra.getTokens(rowText);
  }

  getTokens(row: number): HighlighterToken[] {
    const lineData = this._lineData[row];

    const defaultCellAttr = TermApi.packAttr(0, 257, 256);
    let currentCellAttr = defaultCellAttr;
    const lineCellAttrs = lineData == null ? null : lineData.attrs;

    // const uint32Chars = lineData.chars;
    // let lineLength = uint32Chars.length;

    const tokens: HighlighterToken[] = [];
    const spaceCodePoint = ' '.codePointAt(0);

    // Trim off any unstyled whitespace to the right of the line.
    // while (lineLength !==0 && attrs[lineLength-1] === defAttr && uint32Chars[lineLength-1] === spaceCodePoint) {
    //   lineLength--;
    // }

    let column = 0;
    // const text = lineLength !== uint32Chars.length ? String.fromCodePoint(...uint32Chars.slice(0,lineLength)) : String.fromCodePoint(...uint32Chars);
    const text = this.doc.getLine(row);
    const lineLength = text.length;

    const normalWidthCodePointCutOff = maxNormalWidthCodePoint();
    let spanStart = 0;
    let classList: string[] = [];

    for (let i = 0; i < lineLength; i++, column++) {
      const iCellAttr = lineCellAttrs == null ? defaultCellAttr : lineCellAttrs[i];
      
      // const codePoint = uint32Chars[i];

// FIXME surrogate pair support      
      // const dataOversize = codePoint > normalWidthCodePointCutOff && isCodePointNormalWidth(codePoint) === false;

      // if (dataOversize) {
      //   if (codePoint >= 0x10000) {
      //     // UTF-16 surrogate pair, takes up two chars.
      //     tokens.push( { value: text.slice(column, column+2), type: OVERSIZE_CLASSES } );
      //     column++;
      //   } else {
      //     tokens.push( { value: text.slice(column, column+1), type: OVERSIZE_CLASSES } );
      //   }
      // }

      if (iCellAttr !== currentCellAttr) {

        if (i !== 0) {
          // This is the end of a token. Add it to the list.
          tokens.push({type: " " + classList.join(" "), value: text.slice(spanStart, i)});
          spanStart = i;
        }
        classList = [];
        if (iCellAttr === 0xffffffff) {
          // Cursor itself
          classList.push("reverse-video");
          classList.push("terminal-cursor");
        } else {
        
          let bg = TermApi.backgroundFromCharAttr(iCellAttr);
          let fg = TermApi.foregroundFromCharAttr(iCellAttr);
          const flags = TermApi.flagsFromCharAttr(iCellAttr);
          
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
      }

      currentCellAttr = iCellAttr;
    }

    tokens.push({type: " " + classList.join(" "), value: text.slice(spanStart)});

    return tokens;
  }

  protected _updateInternalDataOnChange(delta: Delta): Fold[] {
    const folds = super._updateInternalDataOnChange(delta);
    console.log("delta:", delta);

    if (delta.action === "insert") {
      this._updateDeltaInsert(delta);
    } else {
      this._updateDeltaRemove(delta);
    }

    return folds;
  }

  private _updateDeltaInsert(delta: Delta): void {
    const rowAttr = this._rowAttributesList[delta.start.row];
    if (delta.lines.length == 1) {
      rowAttr.insertSpaces(delta.start.column, delta.lines[0].length);
    } else {

      // Start row
      const endRowAttr = rowAttr.split(delta.start.column);
      rowAttr.insertSpaces(delta.start.column, delta.lines[0].length);

      // Middle rows
      if (delta.lines.length > 2) {
        const middleLast = delta.lines.length-1;
        const middleRows: RowAttributes[] = [];
        for (let i=1; i<middleLast; i++) {
          middleRows.push(new RowAttributes(delta.lines[i].length));
        }
        this._rowAttributesList.splice.apply(this._rowAttributesList, [delta.start.row+1, 0, ...middleRows]);
      }

      // End row
      endRowAttr.insertSpaces(0, delta.lines[delta.lines.length-1].length);
      this._rowAttributesList.splice(delta.start.row + delta.lines.length-1, 0, endRowAttr);
    }
  }

  private _updateDeltaRemove(delta: Delta): void {
    const startRow = delta.start.row;
    const endColumn = delta.end.column;
    const endRow = delta.end.row;
    if (startRow === endRow) {
      this._rowAttributesList[startRow].cut(delta.start.column, endColumn);
    } else {
      const startRowAttr = this._rowAttributesList[startRow];
      startRowAttr.cut(delta.start.column);
      const endRowAttr = this._rowAttributesList[delta.end.row];
      endRowAttr.cut(0, delta.end.column);
      startRowAttr.insert(startRowAttr.length, endRowAttr);
      if (delta.lines.length > 1) {
        this._rowAttributesList.splice(delta.start.row+1, delta.lines.length-1);
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
