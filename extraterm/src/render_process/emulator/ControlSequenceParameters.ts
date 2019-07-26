/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Parameter {
  intValue: number;
  stringValue: string;
  subParameters: Parameter[];
}

/**
 * Small utility class for gathering parameters to a VT control sequence.
 */
export class ControlSequenceParameters {
  prefix: string = null;
  private _params: Parameter[] = [];
  private _currentParameter: Parameter;

  [index: number]: Parameter;

  constructor() {
    this._currentParameter = this._newParameter();
  }

  get length(): number {
    return this._params.length;
  }

  getDefaultInt(index: number, defaultValue: number): number {
    return index < this._params.length ? this._params[index].intValue : defaultValue;
  }

  appendPrefix(ch: string): void {
    this.prefix = this.prefix + ch;
  }

  appendDigit(ch: string): void {
    this._currentParameter.intValue = this._currentParameter.intValue * 10 + ch.charCodeAt(0) - 48;
  }

  appendString(ch: string): void {
    const currentValue = this._currentParameter.stringValue == null ? "" : this._currentParameter.stringValue;
    this._currentParameter.stringValue = currentValue + ch;
  }

  endParameter(): void {
    if (this._currentParameter.stringValue === null) {
      this._currentParameter.stringValue = "" + this._currentParameter.intValue;
    }

    this[this._params.length] = this._currentParameter;
    this._params.push(this._currentParameter);
    this._currentParameter = this._newParameter();
  }

  private _newParameter(): Parameter {
    return {
      intValue: 0,
      stringValue: null,
      subParameters: []
    };
  }

  getStringList(): string[] {
    return this._params.map(p => p.stringValue);
  }
}
