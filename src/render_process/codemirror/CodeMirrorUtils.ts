import * as CodeMirror from 'codemirror';

/**
 * Paste text at the selection.
 * 
 * When the number of lines in the text matches the number of selections,
 * then each selection gets a line each of the pasted text.
 */
export function pasteText(doc: CodeMirror.Doc, text: string): void {
  // Determine if we need to do a special multiselection paste.
  const allSelections = doc.getSelections();

  // Count the number of lines in the pasted text.
  let lastIndex = 0;
  let matchCount = 0;
  while (matchCount <= allSelections.length) {
    const newIndex = text.indexOf("\n", lastIndex)
    if (newIndex !== -1) {
      matchCount++;
      lastIndex = newIndex + 1;
    } else {
      break;
    }
  }
  if (matchCount + 1 === allSelections.length) {
    doc.replaceSelections(text.split("\n"));
  } else {
    doc.replaceSelection(text);
  }
}
