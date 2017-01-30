/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

/**
 * Interface for elements which can accept a clipboard paste.
 */

export interface SupportsClipboardPaste {
  /**
   * Returns true if this element can accept a paste now.
   * 
   * @return true if this element can accept a paste now.
   */
  canPaste(): boolean;

  /**
   * Paste text into this element.
   * 
   * @param text the text to paste.
   */
  pasteText(text: string): void;
}

export function isSupportsClipboardPaste(el: any): el is SupportsClipboardPaste {
  return (<SupportsClipboardPaste>el).canPaste !== undefined && (<SupportsClipboardPaste>el).pasteText !== undefined;
}
