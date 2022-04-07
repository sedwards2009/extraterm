/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { MonospaceFontMetrics } from "./font_metrics/MonospaceFontMetrics.js";
import { Disposable } from "./Disposable.js";
import { WebGLRenderer } from "./WebGLRenderer.js";
import { TextureFontAtlas } from "./font_atlas/TextureFontAtlas.js";
import { computeFontMetrics } from "./font_metrics/FontMeasurement.js";
import { FontSlice } from "./FontSlice.js";


/**
 * A central repository for sharing `WebGLRenderer` instances.
 */
export class WebGLRendererRepository {

  private _map = new Map<string, WebGLRenderer & Disposable>();
  private _refCount = new Map<string, number>();

  getWebGLRenderer(fontFamily: string, fontStyle: string, fontSizePx: number, extraFonts: FontSlice[], transparentBackground: boolean,
      screenWidthHintPx: number, screenHeightHintPx: number): WebGLRenderer & Disposable {

    const key = this._key(fontFamily, fontSizePx, transparentBackground, extraFonts);
    const existingRenderer = this._map.get(key);
    if (existingRenderer != null) {
      let count = this._refCount.get(key);
      count++;
      this._refCount.set(key, count);
      return existingRenderer;
    }

    const renderer = this._newWebGLRenderer(fontFamily, fontStyle, fontSizePx, extraFonts, transparentBackground,
      screenWidthHintPx, screenHeightHintPx);
    const disposableRenderer = <WebGLRenderer & Disposable> <unknown> {
      __proto__: renderer,
      dispose: () => {
        let value = this._refCount.get(key);
        value--;
        this._refCount.set(key, value);
        if (value === 0) {
          this._map.delete(key);
        }
      }
    };

    this._refCount.set(key, 1);
    this._map.set(key, disposableRenderer);
    return disposableRenderer;
  }

  private _newWebGLRenderer(fontFamily: string, fontStyle: string, fontSizePx: number, extraFonts: FontSlice[],
      transparentBackground: boolean, screenWidthHintPx: number, screenHeightHintPx: number): WebGLRenderer {

    const metrics = computeFontMetrics(fontFamily, fontStyle, fontSizePx);
    const extraFontMetrics = extraFonts.map(
      (extraFont) => this._computeEmojiMetrics(metrics, extraFont.fontFamily, "", extraFont.fontSizePx));

    const fontAtlas = new TextureFontAtlas(metrics, extraFontMetrics, transparentBackground, screenWidthHintPx,
      screenHeightHintPx);
    const renderer = new WebGLRenderer(fontAtlas, transparentBackground);
    renderer.init();
    return renderer;
  }

  private _key(fontFamily: string, fontSizePx: number, transparentBackground: boolean, extraFonts: FontSlice[]): string {
    return `${fontFamily}:${fontSizePx}:${transparentBackground}:` +
      extraFonts.map(ef => `${ef.fontFamily}:${ef.fontSizePx}:`).join("");
  }

  private _computeEmojiMetrics(metrics: MonospaceFontMetrics, fontFamily: string, fontStyle: string,
      fontSizePx: number): MonospaceFontMetrics {

    const customMetrics = {
      ...metrics,
      fontFamily: fontFamily,
      fontSizePx: fontSizePx,
    };
    const actualFontMetrics = computeFontMetrics(fontFamily, fontStyle, fontSizePx, ["\u{1f600}"]  /* Smile emoji */);
    customMetrics.fontSizePx = actualFontMetrics.fontSizePx;
    customMetrics.fillTextYOffset = actualFontMetrics.fillTextYOffset;

    return customMetrics;
  }
}
