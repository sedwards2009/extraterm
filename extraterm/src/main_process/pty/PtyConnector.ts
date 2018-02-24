/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Event} from 'extraterm-extension-api';
import {Pty} from '../../pty/Pty';

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
