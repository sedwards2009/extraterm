/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Parameter {
  intValue: number;
  stringValue: string;
  rawStringValue: string;
  subparameters: ControlSequenceParameters;
}

enum ParameterMode {
  Parameter,
  Subparameter,
}

/**
 * Small utility class for gathering parameters to a VT control sequence.
 */
export class ControlSequenceParameters {
  private _mode = ParameterMode.Parameter;
  prefix = "";
  private _params: Parameter[] = [];
  private _currentParameter: Parameter = null;

  [index: number]: Parameter;

  constructor() {
  }

  private _initializeCurrentParameter(): void {
    if (this._currentParameter == null) {
      this._currentParameter = this._newParameter();
    }
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
    this._initializeCurrentParameter();
    if (this._mode === ParameterMode.Parameter) {
      this._currentParameter.intValue = this._currentParameter.intValue * 10 + ch.charCodeAt(0) - 48;
    } else {
      this._params[this._params.length-1].subparameters.appendDigit(ch);
    }
  }

  appendString(ch: string): void {
    this._initializeCurrentParameter();
    if (this._mode === ParameterMode.Parameter) {
      const currentValue = this._currentParameter.stringValue == null ? "" : this._currentParameter.stringValue;
      this._currentParameter.stringValue = currentValue + ch;
    } else {
      this._params[this._params.length-1].subparameters.appendString(ch);
    }
  }

  nextParameter(): void {
    this._initializeCurrentParameter();
    if (this._mode === ParameterMode.Parameter) {
      this._currentParameter.rawStringValue = this._currentParameter.stringValue;
      if (this._currentParameter.stringValue === null) {
        this._currentParameter.stringValue = "" + this._currentParameter.intValue;
      }

      this[this._params.length] = this._currentParameter;
      this._params.push(this._currentParameter);
      this._currentParameter = this._newParameter();
    } else {
      this._params[this._params.length-1].subparameters.nextParameter();
      this._mode = ParameterMode.Parameter;
    }
  }

  startSubparameter(): void {
    this._mode = ParameterMode.Subparameter;
  }

  private _newParameter(): Parameter {
    return {
      intValue: 0,
      stringValue: null,
      rawStringValue: null,
      subparameters: new ControlSequenceParameters(),
    };
  }

  getStringList(): string[] {
    return this._params.map(p => p.stringValue);
  }
}
