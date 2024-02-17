/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as crypto from 'node:crypto';
import {BulkFileHandle, Event, Disposable} from '@extraterm/extraterm-extension-api';
import * as BulkFileUtils from "../bulk_file_handling/BulkFileUtils.js";
import { EventEmitter } from "extraterm-event-emitter";
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";

import * as TermApi from 'term-api';

import { BulkFileStorage } from '../bulk_file_handling/BulkFileStorage.js';
import { BulkFile } from '../bulk_file_handling/BulkFile.js';
import { StoredBulkFile } from '../bulk_file_handling/StoredBulkFile.js';


export class DownloadApplicationModeHandler /* implements ApplicationModeHandler */ {
  private _log: Logger;
  #currentDownloadSession: DownloadSession = null;

  #bulkFileStorage: BulkFileStorage = null;

  onCreatedBulkFile: Event<BulkFile>;
  #onCreatedBulkFileEventEmitter = new EventEmitter<BulkFile>();

  #emulator: TermApi.EmulatorApi = null;

  constructor(emulator: TermApi.EmulatorApi, bulkFileStorage: BulkFileStorage) {
    this._log = getLogger("DownloadApplicationModeHandler", this);
    this.#emulator = emulator;
    this.#bulkFileStorage = bulkFileStorage;
    this.onCreatedBulkFile = this.#onCreatedBulkFileEventEmitter.event;
  }

  handleStart(parameters: string[]): TermApi.ApplicationModeResponse {
    this.#currentDownloadSession = new DownloadSession(this.#emulator, this.#bulkFileStorage);
    this.#currentDownloadSession.onCreatedBulkFile((bf: BulkFile) => {
      this.#onCreatedBulkFileEventEmitter.fire(bf);
    });
    return this.#currentDownloadSession.handleStart(parameters);
  }

  handleData(data: string): TermApi.ApplicationModeResponse {
    return this.#currentDownloadSession.handleData(data);
  }

  handleStop(): TermApi.ApplicationModeResponse {
    return this.#currentDownloadSession.handleStop();
  }
}


enum DownloadHandlerState {
  IDLE,
  METADATA,
  BODY,
  COMPLETE,
  ERROR
}

const MAX_CHUNK_BYTES = 3 * 1024;
const invalidBodyRegex = /[^\n\rA-Za-z0-9/+:=]/;
const ONE_KILOBYTE = 1024;

class DownloadSession {

  private _log: Logger;
  #emulator: TermApi.EmulatorApi = null;
  #bulkFileStorage: BulkFileStorage = null;
  #state = DownloadHandlerState.IDLE;
  #encodedDataBuffer = "";
  #decodedDataBuffers: Buffer[] = [];
  #metadataSize = -1;
  #previousHash: Buffer = null;
  #bulkFile: StoredBulkFile = null;

  #onCreatedBulkFileEventEmitter = new EventEmitter<BulkFile>();
  onCreatedBulkFile: Event<BulkFile>;

  #createdEventFired = false;

  constructor(emulator: TermApi.EmulatorApi, bulkFileStorage: BulkFileStorage) {
    this._log = getLogger("DownloadApplicationModeHandler DownloadSession", this);
    this.#emulator = emulator;
    this.#bulkFileStorage = bulkFileStorage;
    this.onCreatedBulkFile = this.#onCreatedBulkFileEventEmitter.event;
  }

  handleStart(parameters: string[]): TermApi.ApplicationModeResponse {
    const metadataSize = parseInt(parameters[0], 10);

    this.#metadataSize = metadataSize;
    this.#state = DownloadHandlerState.METADATA;
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  handleData(data: string): TermApi.ApplicationModeResponse {
    switch (this.#state) {
      case DownloadHandlerState.METADATA:
        return this.#handleMetadata(data);

      case DownloadHandlerState.BODY:
        return this.#handleBody(data);

      case DownloadHandlerState.COMPLETE:
        this._log.warn("handleDownloadData called after transmission is complete");
        break;

      case DownloadHandlerState.ERROR:
        break;

      default:
        this._log.warn("handleDownloadData called while in state ", DownloadHandlerState[this.#state]);
        break;
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  #handleMetadata(encodedData: string): TermApi.ApplicationModeResponse {
    this.#encodedDataBuffer += encodedData;
    if (this.#encodedDataBuffer.length >= this.#metadataSize) {
      let metadata = null;
      try {
        metadata = JSON.parse(encodedData.substr(0, this.#metadataSize));
      } catch(ex) {
        this._log.warn("Unable to parse JSON metadata.", ex);
        this.#state = DownloadHandlerState.ERROR;
        return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this.#encodedDataBuffer};
      }
      this.#encodedDataBuffer = this.#encodedDataBuffer.slice(this.#metadataSize);

      this.#bulkFile = this.#bulkFileStorage.createBulkFile(metadata);
      this.#bulkFile.ref();
      this.#bulkFile.getWritableStream().on("drain", this.#handleWritableStreamDrain.bind(this));

      this.#state = DownloadHandlerState.BODY;
      return this.#handleBody("");
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  #fireOnCreatedEvent(force=false): void {
    if (this.#bulkFile == null || this.#createdEventFired) {
      return;
    }

    if (force || this.#bulkFile.getByteCount() >= ONE_KILOBYTE) {
      this.#onCreatedBulkFileEventEmitter.fire(this.#bulkFile);
      this.#createdEventFired = true;
    }
  }

  #closeFileHandle(success: boolean): void {
    if (this.#bulkFile !== null) {
      this.#bulkFile.getWritableStream().end();
      this.#bulkFile.deref();

      const {mimeType, charset} = BulkFileUtils.guessMimetype(this.#bulkFile);
      if (mimeType != null) {
        const metadata = this.#bulkFile.getMetadata();
        if (metadata["mimeType"] == null) {
          this.#bulkFile.setMetadataField("mimeType", mimeType);
          if (charset != null) {
            this.#bulkFile.setMetadataField("charset", charset);
          }
        }
      }

      this.#bulkFile = null;
    }
  }

  #handleBody(encodedData: string): TermApi.ApplicationModeResponse {
    const HASH_LENGTH = 64;

    this.#encodedDataBuffer += encodedData;

    let splitIndex = this.#determineBufferSplitPosition();
    while (splitIndex !== -1) {
      const chunk = this.#encodedDataBuffer.slice(0, splitIndex);

      // Check for invalid characters which may indicate a crash on the remote side.
      if (invalidBodyRegex.test(chunk)) {
        this._log.warn("Chunk contains illegal characters. Aborting.");
        this.#state = DownloadHandlerState.ERROR;
        this.#fireOnCreatedEvent(true);
        this.#closeFileHandle(false);
        return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this.#encodedDataBuffer};
      }

      const tail = this.#encodedDataBuffer.slice(splitIndex);
      if (tail.startsWith("\n") || tail.startsWith("\r")) {
        this.#encodedDataBuffer = tail.slice(1);
      } else {
        this.#encodedDataBuffer = tail;
      }

      if (chunk.length !== 0) {
        const lastColonIndex = chunk.length - HASH_LENGTH - 1;
        const commandChar = chunk.charAt(0);
        if (chunk.charAt(1) !== ":" || chunk.charAt(lastColonIndex) !== ":" || (commandChar !== "D" && commandChar !== "E")) {
          this._log.warn("Data chunk is malformed. Aborting.");
          this.#state = DownloadHandlerState.ERROR;
          this.#fireOnCreatedEvent(true);
          this.#closeFileHandle(false);
          return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this.#encodedDataBuffer};
        }

        const base64Data = chunk.slice(2, lastColonIndex);
        const hashHex = chunk.slice(lastColonIndex+1);

        const decodedBytes = Buffer.from(base64Data, 'base64');

        // Check the hash.
        const hash = crypto.createHash("sha256");
        if (this.#previousHash !== null) {
          hash.update(this.#previousHash);
        }
        hash.update(decodedBytes);
        this.#previousHash = hash.digest();
        if (this.#previousHash.toString("hex") !== hashHex) {
          this._log.warn("Data chunk hash is incorrect.");
          this.#state = DownloadHandlerState.ERROR;
          this.#fireOnCreatedEvent(true);
          this.#closeFileHandle(false);
          return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this.#encodedDataBuffer};
        }
        if (commandChar === "D") {
          this.#decodedDataBuffers.push(decodedBytes);
        } else {
          // End chunk.
          this.#bulkFile.setSuccess(true);
          this.#state = DownloadHandlerState.COMPLETE;
        }
      }
      splitIndex = this.#determineBufferSplitPosition();
    }

    const writeResponse = this.#flushBuffer();
    this.#fireOnCreatedEvent();

    if (this.#state === DownloadHandlerState.BODY && writeResponse === TermApi.ApplicationModeResponseAction.PAUSE) {
      return {action: TermApi.ApplicationModeResponseAction.PAUSE};
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  #determineBufferSplitPosition(): number {
    const MAX_ENCODED_LENGTH = MAX_CHUNK_BYTES * 4 / 3;

    // MAX_ENCODED_LENGTH + : + <sha256.length>
    const MAX_ENCODED_LINE_LENGTH = 2 + MAX_ENCODED_LENGTH + 1 + 64;

    let newLineIndex = this.#encodedDataBuffer.indexOf("\n");
    let crIndex = this.#encodedDataBuffer.indexOf("\r");

    newLineIndex = newLineIndex === -1 ? Number.MAX_SAFE_INTEGER : newLineIndex;
    crIndex = crIndex === -1 ? Number.MAX_SAFE_INTEGER : crIndex;

    const splitIndex = Math.min(newLineIndex, crIndex);
    if (splitIndex !== Number.MAX_SAFE_INTEGER) {
      return Math.min(splitIndex, MAX_ENCODED_LINE_LENGTH);
    } else if (this.#encodedDataBuffer.length >= MAX_ENCODED_LINE_LENGTH) {
      return MAX_ENCODED_LINE_LENGTH;
    }
    return -1;
  }

  #handleWritableStreamDrain(): void {
    this._log.debug(`#handleWritableStreamDrain()`);
    if (this.#bulkFile == null) {
      return;
    }

    if (this.#flushBuffer() === TermApi.ApplicationModeResponseAction.CONTINUE) {
      this.#emulator.resumeProcessing();  // TODO: emit an event instead.
    }
  }

  #flushBuffer(): TermApi.ApplicationModeResponseAction {
    while (this.#decodedDataBuffers.length !== 0) {
      const nextBuffer = this.#decodedDataBuffers[0];
      this.#decodedDataBuffers.splice(0, 1);

      const desiredWriteSize = this.#bulkFile.getDesiredWriteSize();

      let xferBuffer: Buffer = nextBuffer;
      if (nextBuffer.length > desiredWriteSize) {
        // Buffer is bigger than available size. Split it.
        xferBuffer = Buffer.alloc(desiredWriteSize);
        nextBuffer.copy(xferBuffer, 0, 0, desiredWriteSize);

        const secondPartBuffer = Buffer.alloc(xferBuffer.length - desiredWriteSize);
        nextBuffer.copy(secondPartBuffer, 0, desiredWriteSize);
        this.#decodedDataBuffers.splice(0, 1, secondPartBuffer);
      }

      // this._log.debug(`write() ${xferBuffer.length} bytes`);

      if ( ! this.#bulkFile.getWritableStream().write(xferBuffer)) {
        return TermApi.ApplicationModeResponseAction.PAUSE;
      }
    }

    if (this.#decodedDataBuffers.length === 0 && this.#state === DownloadHandlerState.COMPLETE) {
      this.#fireOnCreatedEvent(true);
      this.#closeFileHandle(true);
    }
    return TermApi.ApplicationModeResponseAction.CONTINUE;
  }

  handleStop(): TermApi.ApplicationModeResponse {
    let response: TermApi.ApplicationModeResponse = null;

    this.#flushBuffer();
    this.#fireOnCreatedEvent(true);

    if (this.#state !== DownloadHandlerState.COMPLETE) {
      this.#state = DownloadHandlerState.ERROR;
      this.#closeFileHandle(false);
      response = {action: TermApi.ApplicationModeResponseAction.ABORT};
    } else {
      response = {action: TermApi.ApplicationModeResponseAction.CONTINUE};
    }

    return response;
  }
}
