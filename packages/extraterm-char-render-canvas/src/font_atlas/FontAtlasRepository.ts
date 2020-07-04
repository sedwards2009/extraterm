/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics";
import { Disposable } from "../Disposable";
import { CPURenderedFontAtlas } from "./CPURenderedFontAtlas";
import { ImageBitmapFontAtlas } from "./ImageBitmapFontAtlas";


export abstract class FontAtlasRepository<FA> {

  private _map = new Map<string, FA & Disposable>();
  private _refCount = new Map<string, number>();

  getFontAtlas(metrics: MonospaceFontMetrics): FA & Disposable {
    const key = this._key(metrics);
    const existingAtlas = this._map.get(key);
    if (existingAtlas != null) {
      let count = this._refCount.get(key);
      count++;
      this._refCount.set(key, count);
      return existingAtlas;
    }

    const fontAtlas = this.newFontAtlas(metrics);

    const disposableFA = <FA & Disposable> <unknown> {
      __proto__: fontAtlas,
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
    this._map.set(key, disposableFA);
    return disposableFA;
  }

  protected abstract newFontAtlas(metrics: MonospaceFontMetrics): FA;

  private _key(metrics: MonospaceFontMetrics): string {
    return "" + metrics.fontFamily + ":" + metrics.fontSizePx;
  }
}

export class CPURenderedFontAtlasRepository extends FontAtlasRepository<CPURenderedFontAtlas> {
  protected newFontAtlas(metrics: MonospaceFontMetrics): CPURenderedFontAtlas {
    return new CPURenderedFontAtlas(metrics);
  }
}

export class ImageBitmapFontAtlasRepository extends FontAtlasRepository<ImageBitmapFontAtlas> {
  protected newFontAtlas(metrics: MonospaceFontMetrics): ImageBitmapFontAtlas {
    return new ImageBitmapFontAtlas(metrics);
  }
}
