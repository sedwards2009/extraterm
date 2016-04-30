/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */
import CodeMirror = require('codemirror');

/**
 * Command to extend the selection vertically in both directions as multiple cursors.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function verticalMultiCursor(cm: CodeMirror.Editor): void {
  const doc = cm.getDoc();
  
  const cursorAnchor = doc.getCursor('anchor');
  const cursorHead = doc.getCursor('head');
  const anchorCol = Math.min(cursorHead.ch, cursorAnchor.ch);
  const headCol = Math.max(cursorHead.ch, cursorAnchor.ch);

  const newSelections: { anchor: CodeMirror.Position, head: CodeMirror.Position}[] = [];
  const len = doc.lineCount();
  let primaryIndex = 0;
  for (let i=0; i<len; i++) {
    const lineStr = doc.getLine(i);
    if (lineStr.length >= anchorCol) {
      newSelections.push( {
          anchor: { line: i, ch: anchorCol },
          head: { line: i, ch: Math.min(lineStr.length, headCol ) }
        } );
      if (i === cursorHead.line) {
        primaryIndex = newSelections.length-1;
      }
    }
  }
  doc.setSelections(newSelections, primaryIndex);
}

CodeMirror.commands["verticalMultiCursor"] = verticalMultiCursor;

/**
 * Replaces text in the CodeMirror selection using a RegExp.
 *
 * @param cm the CodeMirror instance to operate on
 * @param searchExp the regular expression matching the strings to replace
 * @param replacement the replacement string
 */
function replaceInSelection(cm: CodeMirror.Editor, searchExp: RegExp, replacement: string): void {
  const selectionsText = cm.getDoc().getSelections();
  const replacements = selectionsText.map( (str) => {
    return str.replace(searchExp, replacement);
  });
  cm.getDoc().replaceSelections(replacements, "around");
}

/**
 * Command to replace forward slashes with back slashes in the selection.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function forwardSlashesToBack(cm: CodeMirror.Editor): void {
  replaceInSelection(cm, /\//g, "\\");
}
CodeMirror.commands["forwardSlashesToBack"] = forwardSlashesToBack;

/**
 * Command to replace back slashes with forward slashes in the selection.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function backSlashesToForward(cm: CodeMirror.Editor): void {
  replaceInSelection(cm, /\\/g, "/");
}
CodeMirror.commands["backSlashesToForward"] = backSlashesToForward;

/**
 * Command to backslash escape possible shell special characters in the selection.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function escapeShellChars(cm: CodeMirror.Editor): void {
  replaceInSelection(cm, /([^a-zA-Z0-9_./,])/g, "\\$1");
}
CodeMirror.commands["escapeShellChars"] = escapeShellChars;

/**
 * Command to unescape backslash escaped shell special characters in the selection.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function unescapeShellChars(cm: CodeMirror.Editor): void {
  replaceInSelection(cm, /\\(.)/g, "$1");
}
CodeMirror.commands["unescapeShellChars"] = unescapeShellChars;

export function init() {
  // This is needed to make sure that the TypeScript compile sees that that module is used and should be included.
}
