/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as crypto from 'crypto';
import {BulkFileHandle, Event, Disposable} from 'extraterm-extension-api';
import {EventEmitter} from '../utils/EventEmitter';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";

import {BulkFileBroker, WriteableBulkFileHandle} from './bulk_file_handling/BulkFileBroker';
import * as TermApi from 'term-api';


export class DownloadApplicationModeHandler /* implements ApplicationModeHandler */ {
  private _log: Logger;
  private _currentDownloadSession: DownloadSession = null;

  onCreatedBulkFile: Event<BulkFileHandle>;
  private _onCreatedBulkFileEventEmitter = new EventEmitter<BulkFileHandle>();
  
  constructor(private _emulator: TermApi.EmulatorApi, private _broker: BulkFileBroker) {
    this._log = getLogger("DownloadApplicationModeHandler", this);
    this.onCreatedBulkFile = this._onCreatedBulkFileEventEmitter.event;
  }

  handleStart(parameters: string[]): TermApi.ApplicationModeResponse {
    this._currentDownloadSession = new DownloadSession(this._emulator, this._broker);
    this._currentDownloadSession.onCreatedBulkFile((b: BulkFileHandle) => {
      this._onCreatedBulkFileEventEmitter.fire(b);
    });
    return this._currentDownloadSession.handleStart(parameters);
  }

  handleData(data: string): TermApi.ApplicationModeResponse {
    return this._currentDownloadSession.handleData(data);
  }

  handleStop(): TermApi.ApplicationModeResponse {
    return this._currentDownloadSession.handleStop();
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
  private _state = DownloadHandlerState.IDLE;
  private _encodedDataBuffer = "";
  private _decodedDataBuffers: Buffer[] = [];
  private _metadataSize = -1;
  private _previousHash: Buffer = null;
  private _fileHandle: WriteableBulkFileHandle = null;
  private _availableWriteBufferSizeChangedDisposable: Disposable = null;

  onCreatedBulkFile: Event<BulkFileHandle>;
  private _onCreatedBulkFileEventEmitter = new EventEmitter<BulkFileHandle>();
  private _createdEventFired = false;

  constructor(private _emulator: TermApi.EmulatorApi, private _broker: BulkFileBroker) {
    this._log = getLogger("DownloadApplicationModeHandler DownloadSession", this);
    this.onCreatedBulkFile = this._onCreatedBulkFileEventEmitter.event;
  }

  handleStart(parameters: string[]): TermApi.ApplicationModeResponse {
    const metadataSize = parseInt(parameters[0], 10);

    this._metadataSize = metadataSize;
    this._state = DownloadHandlerState.METADATA;
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  handleData(data: string): TermApi.ApplicationModeResponse {
    switch (this._state) {
      case DownloadHandlerState.METADATA:
        return this._handleMetadata(data);
    
      case DownloadHandlerState.BODY:
        return this._handleBody(data);

      case DownloadHandlerState.COMPLETE:
        this._log.warn("handleDownloadData called after transmission is complete");
        break;

      case DownloadHandlerState.ERROR:
        break;
        
      default:
        this._log.warn("handleDownloadData called while in state ", DownloadHandlerState[this._state]);
        break;
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  private _handleMetadata(encodedData: string): TermApi.ApplicationModeResponse {
    this._encodedDataBuffer += encodedData;
    if (this._encodedDataBuffer.length >= this._metadataSize) {
      let metadata = null;
      try {
        metadata = JSON.parse(encodedData.substr(0, this._metadataSize));
      } catch(ex) {
        this._log.warn("Unable to parse JSON metadata.", ex);
        this._state = DownloadHandlerState.ERROR;
        return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this._encodedDataBuffer};
      }
      this._encodedDataBuffer = this._encodedDataBuffer.slice(this._metadataSize);

      let filesize = -1;
      if (metadata["filesize"] != null) {
        try {
          filesize = parseInt(metadata["filesize"], 10);
        } catch {
          this._log.warn(`Unable to parse filesize '${metadata["filesize"]}'. Continuing`);
        }
      }

      this._fileHandle = this._broker.createWriteableBulkFileHandle(metadata, filesize);
      this._fileHandle.ref();
      this._availableWriteBufferSizeChangedDisposable = this._fileHandle.onAvailableWriteBufferSizeChange(this._handleAvailableWriteBufferSizeChange.bind(this));

      this._state = DownloadHandlerState.BODY;
      return this._handleBody("");
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  private _fireOnCreatedEvent(force=false): void {
    if (this._fileHandle == null || this._createdEventFired) {
      return;
    }

    if (force || this._fileHandle.getAvailableSize() >= ONE_KILOBYTE) {
      this._onCreatedBulkFileEventEmitter.fire(this._fileHandle);
      this._createdEventFired = true;
    }
  }

  private _closeFileHandle(success: boolean): void {
     if (this._fileHandle !== null) {
      this._fileHandle.close(success);
      this._availableWriteBufferSizeChangedDisposable.dispose();
      this._fileHandle.deref();
      this._fileHandle = null;
    }
  }

  private _handleBody(encodedData: string): TermApi.ApplicationModeResponse {
    const HASH_LENGTH = 64;

    this._encodedDataBuffer += encodedData;

    let splitIndex = this._determineBufferSplitPosition();
    while (splitIndex !== -1) {
      const chunk = this._encodedDataBuffer.slice(0, splitIndex);

      // Check for invalid characters which may indicate a crash on the remote side.
      if (invalidBodyRegex.test(chunk)) {
        this._log.warn("Chunk contains illegal characters. Aborting.");
        this._state = DownloadHandlerState.ERROR;
        this._fireOnCreatedEvent(true);
        this._closeFileHandle(false);
        return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this._encodedDataBuffer};
      }

      const tail = this._encodedDataBuffer.slice(splitIndex);
      if (tail.startsWith("\n") || tail.startsWith("\r")) {
        this._encodedDataBuffer = tail.slice(1);
      } else {
        this._encodedDataBuffer = tail;
      }
      
      if (chunk.length !== 0) {
        const lastColonIndex = chunk.length - HASH_LENGTH - 1;
        const commandChar = chunk.charAt(0);
        if (chunk.charAt(1) !== ":" || chunk.charAt(lastColonIndex) !== ":" || (commandChar !== "D" && commandChar !== "E")) {
          this._log.warn("Data chunk is malformed. Aborting.");
          this._state = DownloadHandlerState.ERROR;
          this._fireOnCreatedEvent(true);
          this._closeFileHandle(false);
          return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this._encodedDataBuffer};
        }
        
        const base64Data = chunk.slice(2, lastColonIndex);
        const hashHex = chunk.slice(lastColonIndex+1);

        const decodedBytes = Buffer.from(base64Data, 'base64');

        // Check the hash.
        const hash = crypto.createHash("sha256");
        if (this._previousHash !== null) {
          hash.update(this._previousHash);
        }
        hash.update(decodedBytes);
        this._previousHash = hash.digest();
        if (this._previousHash.toString("hex") !== hashHex) {
          this._log.warn("Data chunk hash is incorrect.");
          this._state = DownloadHandlerState.ERROR;
          this._fireOnCreatedEvent(true);
          this._closeFileHandle(false);
          return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this._encodedDataBuffer};
        }
        if (commandChar === "D") {
          this._decodedDataBuffers.push(decodedBytes);
        } else {
          // End chunk.
          this._state = DownloadHandlerState.COMPLETE;
        }
      }
      splitIndex = this._determineBufferSplitPosition();
    }

    this._flushBuffer();

    this._fireOnCreatedEvent();

    if (this._state === DownloadHandlerState.BODY && this._fileHandle.getAvailableWriteBufferSize() <= 0) {
      return {action: TermApi.ApplicationModeResponseAction.PAUSE};
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  private _determineBufferSplitPosition(): number {
    const MAX_ENCODED_LENGTH = MAX_CHUNK_BYTES * 4 / 3;
    
    // MAX_ENCODED_LENGTH + : + <sha256.length>
    const MAX_ENCODED_LINE_LENGTH = 2 + MAX_ENCODED_LENGTH + 1 + 64;
    
    let newLineIndex = this._encodedDataBuffer.indexOf("\n");
    let crIndex = this._encodedDataBuffer.indexOf("\r");

    newLineIndex = newLineIndex === -1 ? Number.MAX_SAFE_INTEGER : newLineIndex;
    crIndex = crIndex === -1 ? Number.MAX_SAFE_INTEGER : crIndex;

    const splitIndex = Math.min(newLineIndex, crIndex);
    if (splitIndex !== Number.MAX_SAFE_INTEGER) {
      return Math.min(splitIndex, MAX_ENCODED_LINE_LENGTH);
    } else if (this._encodedDataBuffer.length >= MAX_ENCODED_LINE_LENGTH) {
      return MAX_ENCODED_LINE_LENGTH;
    }
    return -1;
  }

  private _handleAvailableWriteBufferSizeChange(bufferSize: number): void {
    // this._log.debug(`Write buffer size ${bufferSize}`);
    if (this._fileHandle == null) {
      return;
    }

    if (bufferSize > 0) {
      this._flushBuffer();
      this._emulator.resumeProcessing();
    }
  }

  private _flushBuffer(): void {
    while (this._decodedDataBuffers.length !== 0 && this._fileHandle.getAvailableWriteBufferSize() > 0) {
      const availableSize = this._fileHandle.getAvailableWriteBufferSize();
      
      const nextBuffer = this._decodedDataBuffers[0];
      this._decodedDataBuffers.splice(0, 1);

      let xferBuffer: Buffer = nextBuffer;
      if (nextBuffer.length > availableSize) {
        // Buffer is bigger than available size. Split it.
        xferBuffer = Buffer.alloc(availableSize);
        nextBuffer.copy(xferBuffer, 0, 0, availableSize);

        const secondPartBuffer = Buffer.alloc(xferBuffer.length - availableSize);
        nextBuffer.copy(secondPartBuffer, 0, availableSize);
        this._decodedDataBuffers.splice(0, 1, secondPartBuffer);
      }

      this._fileHandle.write(xferBuffer);
    }

    if (this._decodedDataBuffers.length === 0 && this._state === DownloadHandlerState.COMPLETE) {
      this._fireOnCreatedEvent(true);
      this._closeFileHandle(true);
    }
  }

  handleStop(): TermApi.ApplicationModeResponse {
    let response: TermApi.ApplicationModeResponse = null;

    this._flushBuffer();
    this._fireOnCreatedEvent(true);

    if (this._state !== DownloadHandlerState.COMPLETE) {
      this._state = DownloadHandlerState.ERROR;
      this._closeFileHandle(false);
      response = {action: TermApi.ApplicationModeResponseAction.ABORT};
    } else {
      response = {action: TermApi.ApplicationModeResponseAction.CONTINUE};
    }

    return response;
  }
}
