/*
 * Copyright 2017-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, Disposable } from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";

import { BufferSizeChange, Pty } from "../pty/Pty.js";
import { DisposableHolder } from "../utils/DisposableUtils.js";
import { ByteCountingStreamTransform } from "../utils/ByteCountingStreamTransform.js";
import { BulkFile } from "./BulkFile.js";
import { UploadEncoder } from "./UploadEncoder.js";


const DEBUG = false;

/**
 * Uploads files to a remote process over shell and remote's stdin.
 *
 * Format is:
 *
 * '#metadata\n'
 * '#' <base64 encoded metadata JSON string, $BYTES_PER_LINE bytes per line> '\n'
 * '#\n'
 * '#body\n'
 * '#' <base64 encoded binary file data, $BYTES_PER_LINE bytes per line> '\n'
 * '#\n'
 *
 */
export class BulkFileUploader implements Disposable {

  private _log: Logger;
  #onUploadedChangeEmitter = new EventEmitter<number>();
  #onFinishedEmitter = new EventEmitter<void>();
  #uploadEncoder: UploadEncoder = null;
  #stringChunkBuffer: string[] = [];
  #disposables = new DisposableHolder();
  #sourceStream: NodeJS.ReadableStream = null;
  #pipeEnd: NodeJS.ReadableStream = null;
  #isEnding = false;
  #aborted = false;

  #bulkFile: BulkFile = null;
  #pty: Pty = null;

  constructor(bulkFile: BulkFile, pty: Pty) {
    this._log = getLogger("BulkFileUploader", this);

    this.#bulkFile = bulkFile;
    this.#pty = pty;

    this.onUploadedChange = this.#onUploadedChangeEmitter.event;
    this.onFinished = this.#onFinishedEmitter.event;
  }

  abort(): void {
    if (this.#uploadEncoder != null) {
      this.#uploadEncoder.abort();

      this.#pipeEnd.removeAllListeners();
    }
    this.#aborted = true;
    this.#onFinishedEmitter.fire(undefined);
  }

  dispose(): void {
    this.#disposables.dispose();
  }

  onUploadedChange: Event<number>;
  onFinished: Event<void>;

  upload(): void {
    this.#sourceStream = this.#bulkFile.createReadableStream();
    [this.#pipeEnd , this.#uploadEncoder] = this.#configurePipeline(this.#sourceStream);
    this.#sourceStream.on("error", this.#responseOnError.bind(this));
    this.#disposables.add(this.#pty.onAvailableWriteBufferSizeChange(
      this.#handlePtyWriteBufferSizeChange.bind(this)));
  }

  #configurePipeline(sourceStream: NodeJS.ReadableStream): [NodeJS.ReadableStream, UploadEncoder] {
    const byteCountingTransform = new ByteCountingStreamTransform();
    let countSleep = 1024*1024;
    byteCountingTransform.onCountUpdate((count: number) => {
      if (DEBUG) {
        if (count > countSleep) {
          this._log.debug("byte count is ", count / (1024*1024), "MiB");
          countSleep += 1024*1024;
        }
      }
      this.#onUploadedChangeEmitter.fire(count);
    });

    sourceStream.pipe(byteCountingTransform);
    const encoder = new UploadEncoder(this.#bulkFile.getMetadata(), byteCountingTransform);

    encoder.onData(this.#responseOnData.bind(this));
    encoder.onEnd(this.#responseOnEnd.bind(this));
    return [byteCountingTransform, encoder];
  }

  #responseOnData(nextStringChunk: string): void {
    if (this.#aborted) {
      return;
    }

    if (DEBUG) {
      this._log.debug("_responseOnData this._pty.getAvailableWriteBufferSize() = ",this.#pty.getAvailableWriteBufferSize());
    }

    this.#appendToStringChunkBuffer(nextStringChunk);
    this.#transmitStringChunkBuffer();

    if(this.#stringChunkBuffer.length !== 0) {
      this.#pipeEnd.pause();
    }
  }

  #appendToStringChunkBuffer(stringChunk: string): void {
    this.#stringChunkBuffer.push(stringChunk);
    if (DEBUG) {
      this._log.debug("this._stringChunkBuffer.length = ", this.#stringChunkBuffer.length);
    }
  }

  #handlePtyWriteBufferSizeChange(bufferSizeChange: BufferSizeChange): void {
    if (DEBUG) {
      this._log.debug(`availableDelta: ${bufferSizeChange.availableDelta}, totalBufferSize: ${bufferSizeChange.totalBufferSize}, availableWriteBufferSize: ${this.#pty.getAvailableWriteBufferSize()}`);
    }

    this.#transmitStringChunkBuffer();

    // If we were finishing up and there is no more work to do then signal finished.
    if (this.#stringChunkBuffer.length === 0 && this.#isEnding) {
      this.#isEnding = false;
      this.#onFinishedEmitter.fire(undefined);
      return;
    }

    if (this.#stringChunkBuffer.length === 0) {
      if (DEBUG) {
        this._log.debug(`resuming, availableWriteBufferSize: ${this.#pty.getAvailableWriteBufferSize()}`);
      }
      this.#pipeEnd.resume();
    }
  }

  #transmitStringChunkBuffer(): void {
    while (this.#stringChunkBuffer.length !== 0 &&
        this.#stringChunkBuffer[0].length <= this.#pty.getAvailableWriteBufferSize()) {

      const nextStringChunk = this.#stringChunkBuffer[0];
      this.#stringChunkBuffer.splice(0, 1);
      this.#pty.write(nextStringChunk);
    }
  }

  #responseOnEnd(): void {
    if (this.#stringChunkBuffer.length !== 0) {
      this.#isEnding = true;
    } else {
      this.#onFinishedEmitter.fire(undefined);
    }
  }

  #responseOnError(e): void {
    this._log.warn(`Problem with request: ${e.message}`);
  }
}
