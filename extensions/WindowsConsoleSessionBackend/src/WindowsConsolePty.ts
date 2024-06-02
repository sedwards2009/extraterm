/*
 * Copyright 2020-2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EventEmitter} from "extraterm-event-emitter";
import {Event, BufferSizeChange, Pty, Logger, EnvironmentMap} from "@extraterm/extraterm-extension-api";
import * as pty from "node-pty";
import * as _ from "lodash-es";


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

enum PtyState {
  NEW,
  LIVE,
  WAIT_EXIT_CONFIRM,
  DEAD
}

export class WindowsConsolePty implements Pty {

  private realPty: pty.IPty;
  private _permittedDataSize = 0;
  private _paused = true;
  private _state = PtyState.NEW;
  private _onDataEventEmitter = new EventEmitter<string>();
  private _onExitEventEmitter = new EventEmitter<void>();
  private _onAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<BufferSizeChange>();
  private _emitBufferSizeLater: _.DebouncedFunc<any> = null;

  // Amount of data which went directly to the OS but still needs to "announced" via an event.
  private _directWrittenDataCount = 0;

  onData: Event<string>;
  onExit: Event<void>;
  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;

  constructor(private _log: Logger, options: PtyOptions) {
    this.onData = this._onDataEventEmitter.event;
    this.onExit = this._onExitEventEmitter.event;
    this.onAvailableWriteBufferSizeChange = this._onAvailableWriteBufferSizeChangeEventEmitter.event;

    const nodePtyOptions: pty.IWindowsPtyForkOptions = {
      rows: options.rows,
      cols: options.cols,
      name: options.name,
      cwd: options.cwd,
      env: options.env,
      useConpty: false
    };
    this.realPty = pty.spawn(options.exe, options.args, nodePtyOptions);

    this.realPty.onData((data: any): void => {
      this._onDataEventEmitter.fire(data);
      this.permittedDataSize(this._permittedDataSize - data.length);
    });

    this.realPty.onExit(({exitCode, signal}) => {
      if (exitCode !== 0) {
        this._state = PtyState.WAIT_EXIT_CONFIRM;
        this._onDataEventEmitter.fire(`\n\n[Process exited with code ${exitCode}. Press Enter to close this terminal.]`);
      } else {
        this._state = PtyState.DEAD;
        this._onExitEventEmitter.fire(undefined);
      }
    });

    this._emitBufferSizeLater = _.throttle(this._emitAvailableWriteBufferSizeChange.bind(this), 0, {leading: false});

    this.realPty.pause();
    this._state = PtyState.LIVE;

    if (options.preMessage != null && options.preMessage !== "") {
      process.nextTick(() => {
        this._onDataEventEmitter.fire(options.preMessage);
      });
    }
  }

  write(data: string): void {
    if (this._state === PtyState.LIVE) {
      this.realPty.write(data);

      this._directWrittenDataCount += data.length;
      this._emitBufferSizeLater();
    } else if (this._state === PtyState.WAIT_EXIT_CONFIRM) {
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
    if (this._state !== PtyState.LIVE) {
      return;
    }

    this.realPty.resize(cols, rows);
  }

  destroy(): void {
    if (this._state === PtyState.DEAD) {
      return;
    }

    this._log.warn("WindowsConsolePty.destroy()");
    this._emitBufferSizeLater.cancel();
    this.realPty.kill();
    this.realPty = null;
    this._state = PtyState.DEAD;
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

  async getWorkingDirectory(): Promise<string | null> {
    // Note: This doesn't work for PowerShell processes because PS doesn't
    // change its working directory on an OS level when you `cd` through your
    // filesystems.
    // See https://www.itprotoday.com/powershell/why-powershell-working-directory-and-powershell-location-arent-one-same
    // FIXME: the pid-cwd package doesn't play well with ESM and TypeScript. It's index.d.ts is bugged.
    // const pidCwd = await import("pid-cwd");
    // return pidCwd.default(this.realPty.pid);
    return null;
  }
}
