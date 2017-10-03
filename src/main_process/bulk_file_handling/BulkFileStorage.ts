/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from 'crypto';
import {SmartBuffer, SmartBufferOptions} from 'smart-buffer';

import {getLogger, Logger} from '../../logging/Logger';


export type BulkFileIdentifier = string;

export interface Metadata {
  readonly [index: string]: (string | number);
}

export class BulkFileStorage {

  private _log: Logger;
  
  private _fakeStorage = new Map<BulkFileIdentifier, SmartBuffer>();

  constructor(private _tmpDirectory: string) {
    this._log = getLogger("BulkFileStorage", this);
  }

  createBulkFile(metaData: Metadata, size: number): BulkFileIdentifier {
    const identifier = crypto.randomBytes(16).toString('hex');
    this._log.debug("Creating bulk file with identifier: ", identifier);
    this._fakeStorage.set(identifier, new SmartBuffer());
    return identifier;
  }

  write(identifier: BulkFileIdentifier, data: Buffer): void {
    if ( ! this._fakeStorage.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }

    this._log.debug(`Writing ${data.length} bytes to identifier ${identifier}`);

    const buf = this._fakeStorage.get(identifier);
    buf.writeBuffer(data);
  }

  close(identifier: BulkFileIdentifier): void {
    this._log.debug(`Closing identifier ${identifier}`);
    this._log.debug(this._fakeStorage.get(identifier).toString());
  }
}
