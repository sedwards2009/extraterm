/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { TextureFontAtlas, FontSlice, computeFontMetrics, computeEmojiMetrics,
  MonospaceFontMetrics } from "extraterm-char-render-canvas";
import { hasEmojiPresentation } from "extraterm-unicode-utilities";
import { TerminalVisualConfig } from "./TerminalVisualConfig.js";


export interface FontAtlasInfo {
  fontAtlas: TextureFontAtlas;
  metrics: MonospaceFontMetrics;
  extraMetrics: MonospaceFontMetrics[];
}

export class FontAtlasCache {
  #textureFontAtlasCache = new Map<string, FontAtlasInfo>();

  get(terminalVisualConfig: TerminalVisualConfig): FontAtlasInfo {
    const fontInfo = terminalVisualConfig.fontInfo;
    const key = `${fontInfo.family}:${fontInfo.style}:${terminalVisualConfig.fontSizePx}:${terminalVisualConfig.transparentBackground}:${terminalVisualConfig.screenWidthHintPx}:${terminalVisualConfig.screenHeightHintPx}`;
    if (this.#textureFontAtlasCache.has(key)) {
      return this.#textureFontAtlasCache.get(key);
    }

    const fontMetrics = computeFontMetrics(fontInfo.family, fontInfo.style, terminalVisualConfig.fontSizePx);

    const extraFonts: FontSlice[] = [
      {
        fontFamily: "twemoji",
        fontSizePx: 16,
        containsCodePoint: hasEmojiPresentation,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }
    ];
    const extraFontMetrics = extraFonts.map(
      (extraFont) => computeEmojiMetrics(fontMetrics, extraFont.fontFamily, extraFont.fontSizePx));

    const fontAtlas = new TextureFontAtlas(fontMetrics, extraFontMetrics,
      terminalVisualConfig.transparentBackground, terminalVisualConfig.screenWidthHintPx,
      terminalVisualConfig.screenHeightHintPx);

    const fontAtlasInfo: FontAtlasInfo = {
      fontAtlas,
      metrics: fontMetrics,
      extraMetrics: extraFontMetrics
    };
    this.#textureFontAtlasCache.set(key, fontAtlasInfo);
    return fontAtlasInfo;
  }
}
