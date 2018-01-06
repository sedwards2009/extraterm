/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Event} from 'extraterm-extension-api';
import * as pty from 'ptyw.js';

import {PtyConnector as PtyConnector, Pty as Pty, PtyOptions as PtyOptions} from './PtyConnector';
import {Config} from '../../Config';
import {EventEmitter} from '../../utils/EventEmitter';


class DirectPty implements Pty {
  
  private realPty: pty.Terminal;
  private _permittedDataSize = 0; 
  private _paused = true;
  private _onDataEventEmitter = new EventEmitter<string>();
  private _onExitEventEmitter = new EventEmitter<void>();

  onData: Event<string>;
  onExit: Event<void>;

  constructor(file?: string, args?: string[], opt?: PtyOptions) {
    this._onDataEventEmitter = new EventEmitter<string>();
    this.onData = this._onDataEventEmitter.event;

    this._onExitEventEmitter = new EventEmitter<void>();
    this.onExit = this._onExitEventEmitter.event;

    this.realPty = pty.createTerminal(file, args, opt);

    this.realPty.on('data', (data: any): void => {
      this._onDataEventEmitter.fire(data);
      this.permittedDataSize(this._permittedDataSize - data.length);
    });

    this.realPty.on('exit', () => {
      this._onExitEventEmitter.fire(undefined);
    });

    this.realPty.pause();
  }
  
  write(data: any): void {
    this.realPty.write(data);
  }
  
  resize(cols: number, rows: number): void {
    this.realPty.resize(cols, rows);
  }
  
  destroy(): void {
    this.realPty.destroy();
  }

  permittedDataSize(size: number): void {
    this._permittedDataSize = size;
    if (size > 0) {
      if (this._paused) {
        this._paused = false;
        this.realPty.resume();
      }
    } else {
      if ( ! this._paused) {
        this._paused = true;
        this.realPty.pause();
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
