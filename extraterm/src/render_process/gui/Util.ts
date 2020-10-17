/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "../../utils/EventEmitter";


//-------------------------------------------------------------------------

/**
 * Converts an 8bit number to a 2 digit hexadecimal string.
 *
 * @param  {number} value An integer in the range 0-255 inclusive.
 * @return {string}       the converted number.
 */
export function to2DigitHex(value: number): string {
  const h = value.toString(16);
  return h.length === 1 ? "0" + h : h;
}

//-------------------------------------------------------------------------
/**
 * A little class to help load fonts on demand.
 */
export class FontLoader {
  private _knownFontNames = new Set<string>();

  async loadFont(fontName: string, fontPath: string): Promise<void> {
    if ( ! this._knownFontNames.has(fontName)) {
      this._appendFontFaceStyleElement(fontName, fontPath);
      this._knownFontNames.add(fontName);
    }
    await this._fontFaceLoad();
  }

  cssNameFromFontName(fontName: string): string {
    return fontName.replace(/\W/g, "_");
  }

  private _appendFontFaceStyleElement(fontName: string, fontPath: string): void {
    const fontCssName = this.cssNameFromFontName(fontName);
    const el = <HTMLStyleElement> document.createElement("style");
    el.textContent =
      `
      @font-face {
        font-family: "${fontCssName}";
        src: url("${fontPath}");
      }
      `;
    document.head.appendChild(el);
  }

  private async _fontFaceLoad(): Promise<FontFace[]> {
    // Next phase is wait for the fonts to load.
    const fontPromises: Promise<FontFace>[] = [];
    window.document.fonts.forEach( (font: FontFace) => {
      if (font.status !== "loaded" && font.status !== "loading") {
        fontPromises.push(font.load());
      }
    });
    return Promise.all<FontFace>( fontPromises );
  }
}

//-------------------------------------------------------------------------
/**
 * Listener for window DPI changes.
 *
 * `onChange(newDpi)` fires when the window DPI changes.
 */
export class DpiWatcher {
  private _onChangeEventEmitter = new EventEmitter<number>();
  onChange: Event<number>;
  private _mediaQueryList: MediaQueryList = null;

  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
    this._setupListener();
  }

  private _setupListener(): void {
    this._mediaQueryList = window.matchMedia(`(resolution: ${window.devicePixelRatio*96}dpi)`);
    this._mediaQueryList.addEventListener("change", (ev: MediaQueryListEvent) => {
      if ( ! ev.matches) {
        this._onChangeEventEmitter.fire(window.devicePixelRatio);
      }
      this._setupListener();
    });
  }
}
