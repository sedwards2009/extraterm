/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { Command, Editor, OrientedRange, Position } from "ace-ts";


export const ExtraEditCommands: Command<Editor>[] = [];

/**
 * Replaces text in the CodeMirror selection using a RegExp.
 *
 * @param editor the Ace Editor instance to operate on
 * @param searchExp the regular expression matching the strings to replace
 * @param replacement the replacement string
 */
function replaceInSelection(editor: Editor, searchExp: RegExp, replacement: string): void {
  const session = editor.sessionOrThrow();
  const originalRange = editor.getSelectionRange();

  const range = editor.getSelectionRange();
  const text = session.getTextRange(range);
  const newText = text.replace(searchExp, replacement);
  session.replace(range, newText);
  if (editor.selection) {
    let newStart: Position;
    let newEnd: Position;
    if ( ! originalRange.isBackwards) {
      newStart = originalRange.start;
      newEnd = {
        row: originalRange.end.row,
        column: originalRange.end.column + newText.length - text.length
      };
    } else {
      newStart = {
        row: originalRange.start.row,
        column: originalRange.start.column - (newText.length - text.length)
      };
      newEnd = originalRange.end;
    }
    const newRange: OrientedRange = {
        collapseChildren: originalRange.collapseChildren,
        cursor: originalRange.cursor,
        desiredColumn: originalRange.desiredColumn,
        isBackwards: originalRange.isBackwards,
        start: newStart,
        end: newEnd
    };

    editor.selection.setSelectionRange(newRange);
  }
}

/**
 * Command to replace forward slashes with back slashes in the selection.
 */
function forwardSlashesToBack(cm: Editor): void {
  replaceInSelection(cm, /\//g, "\\");
}
export const COMMAND_FORWARDSLASHES_TO_BACK = "forwardSlashesToBack";
ExtraEditCommands.push({
    name: COMMAND_FORWARDSLASHES_TO_BACK,
    exec: forwardSlashesToBack,
    bindKey: null,
    multiSelectAction: "forEach",
    readOnly: false
});

/**
 * Command to replace back slashes with forward slashes in the selection.
 */
function backSlashesToForward(editor: Editor): void {
  replaceInSelection(editor, /\\/g, "/");
}

export const COMMAND_BACKSLASHES_TO_FORWARD = "backSlashesToForward";
ExtraEditCommands.push({
  name: COMMAND_BACKSLASHES_TO_FORWARD,
  exec: backSlashesToForward,
  bindKey: null,
  multiSelectAction: "forEach",
  readOnly: false
});

/**
 * Command to backslash escape possible shell special characters in the selection.
 */
function escapeShellChars(editor: Editor): void {
  replaceInSelection(editor, /([^a-zA-Z0-9_./,])/g, "\\$1");
}
export const COMMAND_ESCAPE_SHELL_CHARS = "escapeShellChars";
ExtraEditCommands.push({
  name: COMMAND_ESCAPE_SHELL_CHARS,
  exec: escapeShellChars,
  bindKey: null,
  multiSelectAction: "forEach",
  readOnly: false
});

/**
 * Command to unescape backslash escaped shell special characters in the selection.
 */
function unescapeShellChars(editor: Editor): void {
  replaceInSelection(editor, /\\(.)/g, "$1");
}
export const COMMAND_UNESCAPE_SHELL_CHARS = "unescapeShellChars";
ExtraEditCommands.push({
  name: COMMAND_UNESCAPE_SHELL_CHARS,
  exec: unescapeShellChars,
  bindKey: null,
  multiSelectAction: "forEach",
  readOnly: false
});

function cursorColumn(editor: Editor): void {
  const selection = editor.session.getSelection();
  if (selection.inMultiSelectMode) {
    return;
  }

  const cursorPosition = selection.getCursor();

  const docLength = editor.session.getLength();
  for (let i=0; i<docLength; i++) {
    if (i !== cursorPosition.row) {
      const newRange: OrientedRange = {
        start: { row: i, column: cursorPosition.column },
        end: { row: i, column: cursorPosition.column },
        collapseChildren: 0,
        cursor: { row: i, column: cursorPosition.column },
        desiredColumn: null,
        isBackwards: false
      };
      selection.addRange(newRange);
    }
  }
}

export const COMMAND_CURSOR_COLUMN = "cursorColumn";
ExtraEditCommands.push({
  name: COMMAND_CURSOR_COLUMN,
  exec: cursorColumn,
  bindKey: null,
  readOnly: false
});
