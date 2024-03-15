/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

interface Param {
  codePointIndex: number;
  codePoints: Uint32Array;
}

const MAX_PARAMS = 1;
const CODEPOINT_ZERO = 0x30;
const CODEPOINT_NINE = 0x39;

export interface ParameterList {
  getParamCount(): number;
  getParameterString(paramIndex: number): string;
  getParameterInt(paramIndex: number): number;
  getDefaultInt(paramIndex: number, def: number): number;
}


export class ControlSequenceParameters implements ParameterList {
  #prefixIndex = 0;
  #prefixCodePoint1 = 0;
  #prefixCodePoint2 = 0;
  #paramIndex = 0;
  #params: Param[] = [];

  constructor() {
    for (let i=0; i<MAX_PARAMS; i++) {
      this.#params.push({
        codePointIndex: 0,
        codePoints: new Uint32Array(1024),
      });
    }
  }

  hasPrefix(): boolean {
    return this.#prefixIndex !== 0;
  }

  appendPrefix(codePoint: number): boolean {
    if (this.#prefixIndex === 2) {
      return false;
    }

    if (this.#prefixIndex === 0) {
      this.#prefixCodePoint1 = codePoint;
    } else {
      this.#prefixCodePoint2 = codePoint;
    }
    this.#prefixIndex++;
    return true;
  }

  getPrefixString(): string {
    if (this.#prefixIndex === 0) {
      return "";
    }
    if (this.#prefixIndex === 1) {
      return String.fromCodePoint(this.#prefixCodePoint1);
    }
    return String.fromCodePoint(this.#prefixCodePoint1, this.#prefixCodePoint2);
  }

  getPrefixLength(): number {
    return this.#prefixIndex;
  }

  reset(): void {
    this.#prefixIndex = 0;
    this.#paramIndex = 0;
    for (let i=0; i<this.#params.length; i++) {
      this.#params[i].codePointIndex = 0;
    }
  }

  getParamCount(): number {
    return this.#paramIndex;
  }

  endParameter(): void {
    this.#paramIndex++;
    if (this.#paramIndex >= this.#params.length) {
      this.#params.push({
        codePointIndex: 0,
        codePoints: new Uint32Array(1024),
      });
    }
  }

  appendParameterCodePoint(codePoint: number):void {
    const param = this.#params[this.#paramIndex];
    const index = param.codePointIndex;
    param.codePoints[index] = codePoint;
    param.codePointIndex++;
  }

  getParameterString(paramIndex: number): string {
    const param = this.#params[paramIndex];
    return String.fromCodePoint(...param.codePoints.slice(0, param.codePointIndex));
  }

  getParameterInt(paramIndex: number): number {
    const param = this.#params[paramIndex];
    let result = 0;
    for (let i=0; i<param.codePointIndex; i++) {
      const codePoint = param.codePoints[i];
      if (codePoint >= CODEPOINT_ZERO && codePoint <= CODEPOINT_NINE) {
        result = result * 10 + (codePoint - CODEPOINT_ZERO);
      } else {
        break;
      }
    }
    return result;
  }

  // TODO: rename
  getDefaultInt(paramIndex: number, def: number): number {
    if (paramIndex >= this.#paramIndex) {
      return def;
    }
    return this.getParameterInt(paramIndex);
  }

  getStringList(): string[] {
    const result = [];
    for (let i=0; i<this.#paramIndex; i++) {
      result.push(this.getParameterString(i));
    }
    return result;
  }

  getExpandParameter(paramIndex: number, splitCodePoint: number): ParameterList {
    const param = this.#params[paramIndex];
    const list: Uint32Array[] = [];
    let startI = 0;
    const codePoints = param.codePoints;
    for (let i=0; i<param.codePointIndex; i++) {
      if (codePoints[i] === splitCodePoint) {
        list.push(codePoints.slice(startI, i));
        startI = i + 1;
      }
    }
    list.push(codePoints.slice(startI, param.codePointIndex));
    return new TinyParameterList(list);
  }
}

class TinyParameterList {
  #paramCodePoints: Uint32Array[];

  constructor(paramCodePointsList: Uint32Array[]) {
    this.#paramCodePoints = paramCodePointsList;
  }

  getParamCount(): number {
    return this.#paramCodePoints.length;
  }

  getParameterString(paramIndex: number): string {
    const param = this.#paramCodePoints[paramIndex];
    return String.fromCodePoint(...param);
  }

  getParameterInt(paramIndex: number): number {
    const paramCodePoints = this.#paramCodePoints[paramIndex];
    let result = 0;
    for (let i=0; i<paramCodePoints.length; i++) {
      const codePoint = paramCodePoints[i];
      if (codePoint >= CODEPOINT_ZERO && codePoint <= CODEPOINT_NINE) {
        result = result * 10 + (codePoint - CODEPOINT_ZERO);
      } else {
        break;
      }
    }
    return result;
  }

  getDefaultInt(paramIndex: number, def: number): number {
    if (paramIndex >= this.#paramCodePoints.length) {
      return def;
    }
    return this.getParameterInt(paramIndex);
  }
}