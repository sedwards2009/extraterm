/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */
import CodeMirror = require('codemirror');

/**
 * Command to extend the selection vertically in both directions as multiple cursors.
 * 
 * @param  {CodeMirror.Editor} cm current CodeMirror instance
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
