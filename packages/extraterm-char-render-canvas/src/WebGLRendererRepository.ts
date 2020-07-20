/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { MonospaceFontMetrics } from "./font_metrics/MonospaceFontMetrics";
import { Disposable } from "./Disposable";
import { WebGLRenderer } from "./WebGLRenderer";
import { TextureFontAtlas } from "./font_atlas/TextureFontAtlas";

/**
 * A central repository for sharing `WebGLRenderer` instances.
 */
export class WebGLRendererRepository {

  private _map = new Map<string, WebGLRenderer & Disposable>();
  private _refCount = new Map<string, number>();

  getWebGLRenderer(metrics: MonospaceFontMetrics, extraFonts: MonospaceFontMetrics[]=[]): WebGLRenderer & Disposable {
    const key = this._key(metrics, extraFonts);
    const existingRenderer = this._map.get(key);
    if (existingRenderer != null) {
      let count = this._refCount.get(key);
      count++;
      this._refCount.set(key, count);
      return existingRenderer;
    }

    const renderer = this._newWebGLRenderer(metrics, extraFonts);
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

  private _newWebGLRenderer(metrics: MonospaceFontMetrics, extraFonts: MonospaceFontMetrics[]): WebGLRenderer {
    const fontAtlas = new TextureFontAtlas(metrics, extraFonts);
    const renderer = new WebGLRenderer(fontAtlas);
    renderer.init();
    return renderer;
  }

  private _key(metrics: MonospaceFontMetrics, extraFonts: MonospaceFontMetrics[]): string {
    return `${metrics.fontFamily}:${metrics.fontSizePx}:` +
      extraFonts.map(ef => `${ef.fontFamily}:${ef.fontSizePx}:`).join("");
  }
}
