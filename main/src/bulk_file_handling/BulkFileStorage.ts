/*
 * Copyright 2017-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { BulkFileMetadata, Event } from '@extraterm/extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";
import { getLogger, Logger } from "extraterm-logging";

import { BulkFile } from "./BulkFile.js";


export type BulkFileIdentifier = string;

export type BufferSizeEvent = {identifier: BulkFileIdentifier, totalBufferSize: number, availableDelta: number};
export type CloseEvent = {identifier: BulkFileIdentifier, success: boolean};


/**
 * Responsible for the temporary storage of large files and serving them via a pseudo web protocol.
 */
export class BulkFileStorage {
  private _log: Logger;

  #urlBase: string = null;
  #storageMap = new Map<BulkFileIdentifier, BulkFile>();
  #storageDirectory: string;
  #onWriteBufferSizeEventEmitter = new EventEmitter<BufferSizeEvent>();
  #onCloseEventEmitter = new EventEmitter<CloseEvent>();

  onWriteBufferSize: Event<BufferSizeEvent>;
  onClose: Event<CloseEvent>;

  constructor(private _tempDirectory: string) {
    this._log = getLogger("BulkFileStorage", this);
    this.#storageDirectory = this._createStorageDirectory(this._tempDirectory);
    this.onWriteBufferSize = this.#onWriteBufferSizeEventEmitter.event;
    this.onClose = this.#onCloseEventEmitter.event;
  }

  setLocalUrlBase(urlBase: string): void {
    this.#urlBase = urlBase;
  }

  /**
   * Create a tmp directory for storing the bulk files.
   *
   * This tries to make the directory in a secure manner because often times
   * the location is in a shared directory like /tmp which may be vulnerable
   * to symlink style attacks.
   */
  private _createStorageDirectory(tempDirectory: string): string {
    const identifier = "extraterm-tmp-storage-" + crypto.randomBytes(16).toString('hex');
    const fullPath = path.join(tempDirectory, identifier);
    try {
      fs.mkdirSync(fullPath, 0o700);
    } catch(e) {
      this._log.warn(`Unable to create temp directory ${fullPath}`, e);
      throw new Error(`Unable to create temp directory ${fullPath}. ${e}`);
    }
    return fullPath;
  }

  private _checkAndSetupStorageDirectory(): boolean {
    try {
      fs.accessSync(this.#storageDirectory, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch (err) {
      this._log.warn(`Bulk file storage directory ${this.#storageDirectory} is no longer accessible!`, err);
    }

    try {
      this.#storageDirectory = this._createStorageDirectory(this._tempDirectory);
      return true;
    } catch (err) {
      this._log.warn(`Attempt to create new bulk file storage directory at ${this.#storageDirectory} failed!`, err);
      return false;
    }
  }

  dispose(): void {
    for (const identifier of this.#storageMap.keys()) {
      this._deleteBulkFile(identifier);
    }

    try {
      fs.rmdirSync(this.#storageDirectory);
    } catch (e) {
      this._log.warn(`Unable to delete directory ${this.#storageDirectory}`, e);
    }
  }

  createBulkFile(metadata: BulkFileMetadata, size: number): {identifier: BulkFileIdentifier, url: string} {
    const onDiskFileIdentifier = crypto.randomBytes(16).toString('hex');

    if ( ! this._checkAndSetupStorageDirectory()) {
      this._log.warn("Unable to create bulk file.");
      return { identifier: null, url: null};
    }

    try {
      const fullPath = path.join(this.#storageDirectory, onDiskFileIdentifier);
      const bulkFile = new BulkFile(metadata, fullPath);
      bulkFile.ref();
      const internalFileIdentifier = crypto.randomBytes(16).toString('hex');

      bulkFile.onWriteBufferSizeChange(({totalBufferSize, availableDelta}): void => {
        this.#onWriteBufferSizeEventEmitter.fire({identifier: internalFileIdentifier, totalBufferSize, availableDelta});
      });

      bulkFile.onClose((payload: {success: boolean}): void => {
        this.#onCloseEventEmitter.fire({identifier: internalFileIdentifier, success: payload.success});
      });

      this.#storageMap.set(internalFileIdentifier, bulkFile);

      return {identifier: internalFileIdentifier, url: this.getUrl(internalFileIdentifier)};
    } catch(e) {
      this._log.warn("Unable to create bulk file on disk.", e);
      return { identifier: null, url: null};
    }
  }

  write(identifier: BulkFileIdentifier, data: Buffer): void {
    if ( ! this.#storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }

    this.#storageMap.get(identifier).write(data);
  }

  close(identifier: BulkFileIdentifier, success: boolean): void {
    if ( ! this.#storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }

    this.#storageMap.get(identifier).close(success);
  }

  ref(identifier: BulkFileIdentifier): void {
    if ( ! this.#storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }
    this.#storageMap.get(identifier).ref();
  }

  deref(identifier: BulkFileIdentifier): void {
    if ( ! this.#storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }
    this.#storageMap.get(identifier).deref();
    this._deleteBulkFile(identifier);
  }

  private _deleteBulkFile(identifier: BulkFileIdentifier): void {
    const bulkFile = this.#storageMap.get(identifier);
    try {
      fs.unlinkSync(bulkFile.filePath);
    } catch(e) {
      this._log.warn(`Unable to delete file ${bulkFile.filePath}`, e);
    }
    this.#storageMap.delete(identifier);
  }

  getBulkFileByIdentifier(identifier: BulkFileIdentifier): BulkFile {
    if ( ! this.#storageMap.has(identifier)) {
      return null;
    }
    return this.#storageMap.get(identifier);
  }

  getUrl(identifier: BulkFileIdentifier): string {
    return `${this.#urlBase}/bulk/${identifier}`;
  }
}
