/*
 * Copyright 2018-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EventEmitter} from "extraterm-event-emitter";
import {Event, BufferSizeChange, Pty, Logger, EnvironmentMap} from "@extraterm/extraterm-extension-api";
import * as _ from "lodash";
import * as child_process from "child_process";
import * as fs from "fs";
import * as pty from "node-pty";


const MAXIMUM_WRITE_BUFFER_SIZE = 64 * 1024;

export interface PtyOptions {
  exe?: string;
  args?: string[];
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

export class UnixPty implements Pty {

  private realPty: pty.IPty;
  private _permittedDataSize = 0;
  private _paused = true;
  private _state = PtyState.NEW;
  private _onDataEventEmitter = new EventEmitter<string>();
  private _onExitEventEmitter = new EventEmitter<void>();
  private _onAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<BufferSizeChange>();
  private _outstandingWriteDataCount = 0;
  private _emitBufferSizeLater: _.DebouncedFunc<any> = null;

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

    this.realPty.on("data", (data: any): void => {
      this._onDataEventEmitter.fire(data);
      this.permittedDataSize(this._permittedDataSize - data.length);
    });

    this.realPty.on("exit", (exitCode: number, signal: number) => {
      if (exitCode !== 0) {
        this._state = PtyState.WAIT_EXIT_CONFIRM;
        this._onDataEventEmitter.fire(`\n\n[Process exited with code ${exitCode}. Press Enter to close this terminal.]`);
      } else {
        this._state = PtyState.DEAD;
        this._onExitEventEmitter.fire(undefined);
      }
    });

    this.realPty.on("drain", () => {
      this._onAvailableWriteBufferSizeChangeEventEmitter.fire({
        totalBufferSize: MAXIMUM_WRITE_BUFFER_SIZE,
        availableDelta: this._outstandingWriteDataCount + this._directWrittenDataCount
      });
      this._directWrittenDataCount = 0;
      this._outstandingWriteDataCount = 0;
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
      if (this.realPty._socket.write(data)) { // FIXME try to avoid using _socket directly. Upgraded node-pty is needed.
        this._directWrittenDataCount += data.length;
        this._emitBufferSizeLater();
      } else {
        this._outstandingWriteDataCount += data.length;
      }
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
    return MAXIMUM_WRITE_BUFFER_SIZE - this._outstandingWriteDataCount - this._directWrittenDataCount;
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

    this._emitBufferSizeLater.cancel();
    this.realPty.destroy();
    this._state = PtyState.DEAD;
  }

  permittedDataSize(size: number): void {
    if (this._state !== PtyState.LIVE) {
      return;
    }

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

  async getWorkingDirectory(): Promise<string> {
    if (this._state !== PtyState.LIVE) {
      return null;
    }

    if (process.platform === "linux") {
      return this._getLinuxWorkingDirectory();
    } else if (process.platform === "darwin") {
      return this._getDarwinWorkingDirectory();
    } else {
      return null;
    }
  }

  private async _getLinuxWorkingDirectory(): Promise<string> {
    try {
      const cwd = await fs.promises.readlink(`/proc/${this.realPty.pid}/cwd`, {encoding: "utf8"});
      return cwd;
    } catch (err) {
      this._log.warn(err);
    }
    return null;
  }

  private async _getDarwinWorkingDirectory(): Promise<string> {
    try {
      const lsofParams = ["-a", "-d", "cwd", "-p", "" + this.realPty.pid, "-F", "n0"];  // 'n0'=path and nul delimited
      const output = child_process.execFileSync("/usr/sbin/lsof", lsofParams, {encoding: "utf8"});

      let cwd: string = null;
      const parts = output.split("\x00");
      for (const part of parts) {
        if (part.startsWith("n")) {
          cwd = part.substring(1);
        }
      }
      return cwd;
    } catch (err) {
      this._log.warn(err);
    }
    return null;
  }
}
