/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */
import * as CodeMirror from 'codemirror';

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
  const wholeHeight = cursorAnchor.line === cursorHead.line;
  const start = wholeHeight ? 0 : Math.min(cursorAnchor.line, cursorHead.line);
  const end = wholeHeight? doc.lineCount() : Math.max(cursorAnchor.line, cursorHead.line) + 1;
  let primaryIndex = 0;
  for (let i=start; i<end; i++) {
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
export const COMMAND_VERTICAL_MULTICURSOR = "verticalMultiCursor";
CodeMirror.commands[COMMAND_VERTICAL_MULTICURSOR] = verticalMultiCursor;

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
export const COMMAND_FORWARDSLASHES_TO_BACK = "forwardSlashesToBack";
CodeMirror.commands[COMMAND_FORWARDSLASHES_TO_BACK] = forwardSlashesToBack;

/**
 * Command to replace back slashes with forward slashes in the selection.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function backSlashesToForward(cm: CodeMirror.Editor): void {
  replaceInSelection(cm, /\\/g, "/");
}

export const COMMAND_BACKSLASHES_TO_FORWARD = "backSlashesToForward";
CodeMirror.commands[COMMAND_BACKSLASHES_TO_FORWARD] = backSlashesToForward;

/**
 * Command to backslash escape possible shell special characters in the selection.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function escapeShellChars(cm: CodeMirror.Editor): void {
  replaceInSelection(cm, /([^a-zA-Z0-9_./,])/g, "\\$1");
}
export const COMMAND_ESCAPE_SHELL_CHARS = "escapeShellChars";
CodeMirror.commands[COMMAND_ESCAPE_SHELL_CHARS] = escapeShellChars;

/**
 * Command to unescape backslash escaped shell special characters in the selection.
 * 
 * @param cm the CodeMirror instance to operate on
 */
function unescapeShellChars(cm: CodeMirror.Editor): void {
  replaceInSelection(cm, /\\(.)/g, "$1");
}
export const COMMAND_UNESCAPE_SHELL_CHARS = "unescapeShellChars";
CodeMirror.commands[COMMAND_UNESCAPE_SHELL_CHARS] = unescapeShellChars;

function toggleLineNumbers(cm: CodeMirror.Editor): void {
  const isSet = cm.getOption("lineNumbers");
  cm.setOption("lineNumbers", ! isSet);
}
export const COMMAND_TOGGLE_LINE_NUMBERS = "toggleLineNumbers";

export function init() {
  // This is needed to make sure that the TypeScript compile sees that that module is used and should be included.
}

export function isCommand(command: string): boolean {
  return [COMMAND_FORWARDSLASHES_TO_BACK,
      COMMAND_BACKSLASHES_TO_FORWARD,
      COMMAND_ESCAPE_SHELL_CHARS,
      COMMAND_UNESCAPE_SHELL_CHARS,
      COMMAND_VERTICAL_MULTICURSOR,
      COMMAND_TOGGLE_LINE_NUMBERS,
    ].indexOf(command) !== -1;
}

export function executeCommand(cm: CodeMirror.Editor, command: string): void {
  if (command === COMMAND_TOGGLE_LINE_NUMBERS) {
    toggleLineNumbers(cm);
  } else {
    cm.execCommand(command);
  }
}

export interface CommandDescription {
  command: string;
  iconLeft?: string;
  iconRight?: string;
  label: string;
}

export function commandDescriptions(cm: CodeMirror.Editor): CommandDescription[] {
  const descriptions: CommandDescription[] = [
    { command: COMMAND_FORWARDSLASHES_TO_BACK, iconRight: "", label: "Forward Slashes to Backslashes" },
    { command: COMMAND_BACKSLASHES_TO_FORWARD, iconRight: "", label: "Backslashes to Forward Slashes" },
    { command: COMMAND_ESCAPE_SHELL_CHARS, iconRight: "", label: "Escape Shell Characters" },
    { command: COMMAND_UNESCAPE_SHELL_CHARS, iconRight: "", label: "Unescape Shell Characters" },
    { command: COMMAND_VERTICAL_MULTICURSOR, iconRight: "", label: "Selection to Multiple Cursors" },
    { command: COMMAND_TOGGLE_LINE_NUMBERS, iconLeft: cm.getOption("lineNumbers") ? "check-square-o" : "square-o",
      iconRight: "list-ol", label: "Line Numbers" },
  ];
  return descriptions;
}
