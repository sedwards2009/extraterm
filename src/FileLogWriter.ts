import * as fs from 'fs';
import {LogWriter, Level} from './Logger';

export class FileLogWriter implements LogWriter {

  private _fhandle: number = -1;

  constructor(filename: string) {
    this._fhandle = fs.openSync(filename, 'a');
  }

  write(level: Level, msg: string, ...opts: any[]): void {
    fs.writeSync(this._fhandle, Buffer.from(msg));

    fs.writeSync(this._fhandle, Buffer.from(opts.join(', ')));
    fs.writeSync(this._fhandle, Buffer.from('\n'));
  }
}
