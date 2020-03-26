/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as fs from 'fs';
import {LogWriter, Level} from './Logger';

export class FileLogWriter implements LogWriter {

  private _fhandle: number = -1;

  constructor(private _filename: string) {
  }

  open(): void {
    this._fhandle = fs.openSync(this._filename, fs.constants.O_WRONLY | fs.constants.O_CREAT);
  }

  write(level: Level, msg: string, ...opts: any[]): void {
    fs.writeSync(this._fhandle, Buffer.from(msg));
    fs.writeSync(this._fhandle, Buffer.from(' '));

    const strOpts = opts.map(opt => typeof opt === 'string' ? opt : JSON.stringify(opt, null, 4));

    fs.writeSync(this._fhandle, Buffer.from(strOpts.join(', ')));
    fs.writeSync(this._fhandle, Buffer.from('\n'));
  }
}
