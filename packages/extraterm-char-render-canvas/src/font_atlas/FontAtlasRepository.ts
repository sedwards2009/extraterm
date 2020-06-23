/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics";
import { FontAtlas } from "./FontAtlas";
import { FontAtlasImpl } from "./FontAtlasImpl";
import { Disposable } from "../Disposable";


export class FontAtlasRepository {

  private _map = new Map<string, FontAtlas & Disposable>();
  private _refCount = new Map<string, number>();

  getFontAtlas(metrics: MonospaceFontMetrics): FontAtlas & Disposable {
    const key = this._key(metrics);
    const existingAtlas = this._map.get(key);
    if (existingAtlas != null) {
      let count = this._refCount.get(key);
      count++;
      this._refCount.set(key, count);
      return existingAtlas;
    }

    const fontAtlas = new FontAtlasImpl(metrics);
    const disposableFontAtlas: FontAtlas & Disposable = {
      drawCodePoint: fontAtlas.drawCodePoint.bind(fontAtlas),
      drawCodePointToImageData: fontAtlas.drawCodePointToImageData.bind(fontAtlas),
      drawCodePoints: fontAtlas.drawCodePoints.bind(fontAtlas),
      drawCodePointsToImageData: fontAtlas.drawCodePointsToImageData.bind(fontAtlas),
      getCanvas: fontAtlas.getCanvas.bind(fontAtlas),

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
    this._map.set(key, disposableFontAtlas);
    return disposableFontAtlas;
  }

  private _key(metrics: MonospaceFontMetrics): string {
    return "" + metrics.fontFamily + ":" + metrics.fontSizePx;
  }
}
