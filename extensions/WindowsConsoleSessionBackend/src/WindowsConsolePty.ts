/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EventEmitter} from 'extraterm-event-emitter';
import {Event, BufferSizeChange, Pty, Logger, EnvironmentMap} from 'extraterm-extension-api';
import * as pty from 'node-pty';
import * as _ from 'lodash';


const MAXIMUM_WRITE_BUFFER_SIZE = 64 * 1024;

export interface PtyOptions {
  exe?: string;
  args?: string[];
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: EnvironmentMap;
  preMessage?: string;
}

export class WindowsConsolePty implements Pty {

  private realPty: pty.IPty;
  private _permittedDataSize = 0;
  private _paused = true;
  private _waitingExitConfirmation = false;
  private _destroyed = false;
  private _onDataEventEmitter = new EventEmitter<string>();
  private _onExitEventEmitter = new EventEmitter<void>();
  private _onAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<BufferSizeChange>();
  private _emitBufferSizeLater: (() => void) & _.Cancelable = null;

  // Amount of data which went directly to the OS but still needs to 'announced' via an event.
  private _directWrittenDataCount = 0;

  onData: Event<string>;
  onExit: Event<void>;
  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;

  constructor(private _log: Logger, options: PtyOptions) {
    this.onData = this._onDataEventEmitter.event;
    this.onExit = this._onExitEventEmitter.event;
    this.onAvailableWriteBufferSizeChange = this._onAvailableWriteBufferSizeChangeEventEmitter.event;

    this.realPty = pty.spawn(options.exe, options.args, options);

    this.realPty.on('data', (data: any): void => {
      this._onDataEventEmitter.fire(data);
      this.permittedDataSize(this._permittedDataSize - data.length);
    });

    this.realPty.on('exit', () => {
      this._waitingExitConfirmation = true;
      this._onDataEventEmitter.fire("\n\n[Process exited. Press Enter to close this terminal.]");
    });

    this._emitBufferSizeLater = _.throttle(this._emitAvailableWriteBufferSizeChange.bind(this), 0, {leading: false});

    this.realPty.pause();

    if (options.preMessage != null && options.preMessage !== "") {
      process.nextTick(() => {
        this._onDataEventEmitter.fire(options.preMessage);
      });
    }
  }

  write(data: string): void {
    if ( ! this._waitingExitConfirmation) {
      this.realPty.write(data);

      this._directWrittenDataCount += data.length;
      this._emitBufferSizeLater();
    } else {
      // See if the user hit the Enter key to fully close the terminal.
      if (data.indexOf("\r") !== -1) {
        this._onExitEventEmitter.fire(undefined);
      }
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
    return MAXIMUM_WRITE_BUFFER_SIZE;
  }

  resize(cols: number, rows: number): void {
    this.realPty.resize(cols, rows);
  }

  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this._log.warn("WindowsConsolePty.destroy()");
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
