/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Event} from 'extraterm-extension-api';

/**
 * Represents a PTY.
 */
export interface Pty {
  /**
   * Write data to the pty
   *
   * @param data data to write.
   */
  write(data: any): void;

  /**
   * Tell the pty that the size of the terminal has changed
   *
   * @param cols number of columns in ther terminal.
   * @param rows number of rows in the terminal.
   */
  resize(cols: number, rows: number): void;

  permittedDataSize(size: number): void;

  /**
   * Destroy the pty and shut down the attached process
   */
  destroy(): void;
  
  onData: Event<string>;
  
  onExit: Event<void>;
}

export interface EnvironmentMap {
  [key:string]: string;
}

export interface PtyOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: EnvironmentMap;
}

export interface PtyConnector {
  spawn(file: string, args: string[], opt: PtyOptions): Pty;
  destroy(): void;
}
