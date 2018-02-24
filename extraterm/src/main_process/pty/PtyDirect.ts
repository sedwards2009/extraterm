/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Event} from 'extraterm-extension-api';
import * as pty from 'ptyw.js';

import {Config} from '../../Config';
import {DebouncedDoLater} from '../../utils/DoLater';
import {EventEmitter} from '../../utils/EventEmitter';
import {getLogger, Logger} from '../../logging/Logger';
import {Pty, BufferSizeChange} from '../../pty/Pty';
import {PtyConnector, PtyOptions} from './PtyConnector';

const MAXIMUM_WRITE_BUFFER_SIZE = 64 * 1024;


class DirectPty implements Pty {

  private _log: Logger;
  private realPty: pty.Terminal;
  private _permittedDataSize = 0; 
  private _paused = true;
  private _onDataEventEmitter = new EventEmitter<string>();
  private _onExitEventEmitter = new EventEmitter<void>();
  private _onAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<BufferSizeChange>();
  private _outstandingWriteDataCount = 0;
  private _emitBufferSizeLater: DebouncedDoLater = null;

  // Amount of data which went directly tothe OS but still needs to 'announced' via an event.
  private _directWrittenDataCount = 0;

  onData: Event<string>;
  onExit: Event<void>;
  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;

  constructor(file?: string, args?: string[], opt?: PtyOptions) {
    this._log = getLogger("DirectPty", this);
    this.onData = this._onDataEventEmitter.event;
    this.onExit = this._onExitEventEmitter.event;
    this.onAvailableWriteBufferSizeChange = this._onAvailableWriteBufferSizeChangeEventEmitter.event;

    this.realPty = pty.createTerminal(file, args, opt);

    this.realPty.on('data', (data: any): void => {
      this._onDataEventEmitter.fire(data);
      this.permittedDataSize(this._permittedDataSize - data.length);
    });

    this.realPty.on('exit', () => {
      this._onExitEventEmitter.fire(undefined);
    });

    this.realPty.socket.on('drain', () => {
      this._onAvailableWriteBufferSizeChangeEventEmitter.fire({
        totalBufferSize: MAXIMUM_WRITE_BUFFER_SIZE,
        availableDelta: this._outstandingWriteDataCount + this._directWrittenDataCount
      });
      this._directWrittenDataCount = 0;
      this._outstandingWriteDataCount = 0;
    });

    this._emitBufferSizeLater = new DebouncedDoLater(this._emitAvailableWriteBufferSizeChange.bind(this));

    this.realPty.pause();
  }
  
  write(data: string): void {
    if (this.realPty.write(data)) {
      this._directWrittenDataCount += data.length;
      this._emitBufferSizeLater.trigger();
    } else {
      this._outstandingWriteDataCount += data.length;
    }
  }

  private _emitAvailableWriteBufferSizeChange(): void {
    if (this._directWrittenDataCount !== 0) {
      const writtenCount = this._directWrittenDataCount;
      this._directWrittenDataCount = 0;
      this._onAvailableWriteBufferSizeChangeEventEmitter.fire({
        totalBufferSize: MAXIMUM_WRITE_BUFFER_SIZE,
        availableDelta: writtenCount
      });
    }
  }

  getAvailableWriteBufferSize(): number {
    return MAXIMUM_WRITE_BUFFER_SIZE - this._outstandingWriteDataCount - this._directWrittenDataCount;
  }

  resize(cols: number, rows: number): void {
    this.realPty.resize(cols, rows);
  }
  
  destroy(): void {
    this._emitBufferSizeLater.cancel();
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
