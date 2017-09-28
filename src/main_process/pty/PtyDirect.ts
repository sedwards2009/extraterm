/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as pty from 'ptyw.js';
import {PtyConnector as PtyConnector, Pty as Pty, PtyOptions as PtyOptions} from './PtyConnector';
import * as configInterfaces from '../../Config';
type Config = configInterfaces.Config;

class DirectPty implements Pty {
  
  private realPty: pty.Terminal;
    
  private _onDataCallback: (data: any) => void = null;

  private _permittedDataSize = 0;
  
  private _paused = true;

  constructor(file?: string, args?: string[], opt?: PtyOptions) {
    this.realPty = pty.createTerminal(file, args, opt);

    this.realPty.on('data', (data: any): void => {
      if (this._onDataCallback != null) {
        this._onDataCallback(data);
      }
      this.permittedDataSize(this._permittedDataSize - data.length);
    });

    this.realPty.pause();
  }
  
  write(data: any): void {
    this.realPty.write(data);
  }
  
  resize(cols: number, rows: number): void {
    this.realPty.resize(cols, rows);
  }
  
  onData(callback: (data: any) => void): void {
    this._onDataCallback = callback;
  }
  
  onExit(callback: () => void): void {
    this.realPty.on('exit', callback);
  }
  
  destroy(): void {
    this.realPty.destroy();
  }

  permittedDataSize(size: number): void {
    this._permittedDataSize = size;
    if (size > 0) {
      if (this._paused) {
        this.realPty.resume();
        this._paused = false;
      }
    } else {
      if ( ! this._paused) {
        this.realPty.pause();
        this._paused = true;
      }
    }
  }
}

function spawn(file: string, args: string[], opt: PtyOptions): Pty {
  return new DirectPty(file, args, opt);
}

export function factory(config: Config): PtyConnector {
  return {
    spawn: spawn,
    destroy() {}
  };
}
