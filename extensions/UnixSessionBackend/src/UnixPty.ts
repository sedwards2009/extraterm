/*
 * Copyright 2018-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EventEmitter} from "extraterm-event-emitter";
import {Event, BufferSizeChange, Pty, Logger, EnvironmentMap} from "@extraterm/extraterm-extension-api";
import { DebouncedDoLater } from "extraterm-later";
import * as child_process from "node:child_process";
import * as fs from "node:fs";
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

  private _log: Logger;
  #realPty: pty.IPty;
  #permittedDataSize = 0;
  #paused = true;
  #state = PtyState.NEW;
  #onDataEventEmitter = new EventEmitter<string>();
  #onExitEventEmitter = new EventEmitter<void>();
  #onAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<BufferSizeChange>();
  #outstandingWriteDataCount = 0;
  #emitBufferSizeLater: DebouncedDoLater = null;

  // Amount of data which went directly to the OS but still needs to 'announced' via an event.
  #directWrittenDataCount = 0;

  onData: Event<string>;
  onExit: Event<void>;
  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;

  constructor(log: Logger, options: PtyOptions) {
    this._log = log;
    this.onData = this.#onDataEventEmitter.event;
    this.onExit = this.#onExitEventEmitter.event;
    this.onAvailableWriteBufferSizeChange = this.#onAvailableWriteBufferSizeChangeEventEmitter.event;

    this.#realPty = pty.spawn(options.exe, options.args, options);

    this.#realPty.onData((data: any): void => {
      this.#onDataEventEmitter.fire(data);
      this.permittedDataSize(this.#permittedDataSize - data.length);
    });

    this.#realPty.onExit(({exitCode, signal}) => {
      if (exitCode !== 0) {
        this.#state = PtyState.WAIT_EXIT_CONFIRM;
        this.#onDataEventEmitter.fire(`\n\n[Process exited with code ${exitCode}. Press Enter to close this terminal.]`);
      } else {
        this.#state = PtyState.DEAD;
        this.#onExitEventEmitter.fire(undefined);
      }
    });

    this.#emitBufferSizeLater = new DebouncedDoLater(this.#emitAvailableWriteBufferSizeChange.bind(this), 0);

    this.#realPty.on("drain", () => {
      this.#directWrittenDataCount = 0;
      this.#outstandingWriteDataCount = 0;
      this.#emitBufferSizeLater.trigger();
    });

    this.#realPty.pause();
    this.#state = PtyState.LIVE;

    if (options.preMessage != null && options.preMessage !== "") {
      process.nextTick(() => {
        this.#onDataEventEmitter.fire(options.preMessage);
      });
    }
  }

  write(data: string): void {
    if (this.#state === PtyState.LIVE) {
      if (this.#realPty._socket.write(data)) { // FIXME try to avoid using _socket directly. Upgraded node-pty is needed.
        this.#directWrittenDataCount += data.length;
        this.#emitBufferSizeLater.trigger();
      } else {
        this.#outstandingWriteDataCount += data.length;
      }
    } else if (this.#state === PtyState.WAIT_EXIT_CONFIRM) {
      // See if the user hit the Enter key to fully close the terminal.
      if (data.indexOf("\r") !== -1) {
        this.#onExitEventEmitter.fire(undefined);
      }
    }
  }

  #emitAvailableWriteBufferSizeChange(): void {
    const writtenCount = this.#directWrittenDataCount;
    this.#directWrittenDataCount = 0;
    this.#onAvailableWriteBufferSizeChangeEventEmitter.fire({
      totalBufferSize: MAXIMUM_WRITE_BUFFER_SIZE,
      availableDelta: writtenCount
    });
  }

  getAvailableWriteBufferSize(): number {
    return MAXIMUM_WRITE_BUFFER_SIZE - this.#outstandingWriteDataCount - this.#directWrittenDataCount;
  }

  resize(cols: number, rows: number): void {
    if (this.#state !== PtyState.LIVE) {
      return;
    }

    this.#realPty.resize(cols, rows);
  }

  destroy(): void {
    if (this.#state === PtyState.DEAD) {
      return;
    }

    this.#emitBufferSizeLater.cancel();
    this.#realPty.destroy();
    this.#state = PtyState.DEAD;
  }

  permittedDataSize(size: number): void {
    if (this.#state !== PtyState.LIVE) {
      return;
    }

    this.#permittedDataSize = size;
    if (size > 0) {
      if (this.#paused) {
        this.#paused = false;
        this.#realPty.resume();
      }
    } else {
      if ( ! this.#paused) {
        this.#paused = true;
        this.#realPty.pause();
      }
    }
  }

  async getWorkingDirectory(): Promise<string> {
    if (this.#state !== PtyState.LIVE) {
      return null;
    }

    if (process.platform === "linux") {
      return this.#getLinuxWorkingDirectory();
    } else if (process.platform === "darwin") {
      return this.#getDarwinWorkingDirectory();
    } else {
      return null;
    }
  }

  async #getLinuxWorkingDirectory(): Promise<string> {
    try {
      const cwd = await fs.promises.readlink(`/proc/${this.#realPty.pid}/cwd`, {encoding: "utf8"});
      return cwd;
    } catch (err) {
      this._log.warn(err);
    }
    return null;
  }

  async #getDarwinWorkingDirectory(): Promise<string> {
    try {
      const lsofParams = ["-a", "-d", "cwd", "-p", "" + this.#realPty.pid, "-F", "n0"];  // 'n0'=path and nul delimited
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
