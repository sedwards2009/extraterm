/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

export interface FontSlice {
  /**
   * Font family to render the cells using
   *
   * The exact name is the same as that required by CSS.
   */
  fontFamily: string;

  /**
   * Size of the font in pixels
   */
  fontSizePx: number;

  /**
   * Set to true if the font is a color font
   */
  isColor?: boolean;

  /**
   * Characters used to determine the effective size of the glyphs
   *
   * These characters are rendered and examined on the pixel level to
   * determine the actual size of the font on the screen.
   */
  sampleChars?: string[];

  /**
   * Predicate to signal if a code point is covered by this font.
   */
  containsCodePoint: (codePoint: number) => boolean;
}
