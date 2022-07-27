/*
 * Copyright 2017-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "node:crypto";
import { BulkFileMetadata, Event } from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";


const BYTES_PER_LINE = 3 * 240;
const DEBUG = false;
const HASH_LENGTH = 20; // 20 hex chars hash length


export class UploadEncoder {

  private _log: Logger;
  #doneIntro = false;
  #buffer: Buffer = Buffer.alloc(0);
  #abort = false;
  #previousHash: Buffer = null;
  #onDataEmitter = new EventEmitter<string>();
  #onEndEmitter = new EventEmitter<undefined>();
  #metadata: BulkFileMetadata;
  #readable: NodeJS.ReadableStream;

  onData: Event<string>;
  onEnd: Event<undefined>;

  constructor(metadata: BulkFileMetadata, readable: NodeJS.ReadableStream) {
    this._log = getLogger("UploadEncoder", this);
    this.#metadata = metadata;
    this.#readable = readable;
    this.onData = this.#onDataEmitter.event;
    this.onEnd = this.#onEndEmitter.event;

    this.#readable.on("data", this.#responseOnData.bind(this));
    this.#readable.on("end", this.#responseOnEnd.bind(this));
  }

  #responseOnData(chunk: Buffer): void {
    if ( ! this.#abort) {
      this.#appendChunkToBuffer(chunk);
      if ( ! this.#doneIntro) {
        this.#doneIntro = true;
        this.#sendHeader();
      }
      this.#sendBuffer();
    }
  }

  #appendChunkToBuffer(chunk: Buffer): void {
    if (this.#buffer.length !== 0) {
      const combinedBuffer = Buffer.alloc(this.#buffer.length + chunk.length);
      this.#buffer.copy(combinedBuffer);
      chunk.copy(combinedBuffer, this.#buffer.length);
      this.#buffer = combinedBuffer;
    } else {
      this.#buffer = chunk;
    }
  }

  #sendHeader(): void {
    const jsonString = JSON.stringify(this.#metadata);
    this.#sendLine("M", Buffer.from(jsonString, "utf8"));
  }

  #sendLine(command: string, content: Buffer): void {
    if (DEBUG) {
      this._log.debug("_sendLine command=",command);
    }
    this.#onDataEmitter.fire(this.#encodeLine(command, content));
  }

  #sendBuffer(): void {
    const lines = Math.floor(this.#buffer.length/BYTES_PER_LINE);
    for (let i = 0; i < lines; i++) {
      const lineBuffer = this.#buffer.slice(i*BYTES_PER_LINE, (i+1) * BYTES_PER_LINE);
      this.#sendLine("D", lineBuffer);
    }

    const remainder = this.#buffer.length % BYTES_PER_LINE;
    if (remainder !== 0) {
      const newBuffer = Buffer.alloc(remainder);
      this.#buffer.copy(newBuffer, 0, this.#buffer.length-remainder, this.#buffer.length);
      this.#buffer = newBuffer;
    } else {
      this.#buffer = Buffer.alloc(0);
    }
  }

  #encodeLine(command: string, content: Buffer): string {
    const parts: string[] = [];

    parts.push("#");
    parts.push(command);
    parts.push(":");

    const hash = crypto.createHash("sha256");
    if (this.#previousHash !== null) {
      hash.update(this.#previousHash);
    }

    if (content !== null && content.length !==0) {
      hash.update(content);
      parts.push(content.toString("base64"));
    }

    this.#previousHash = hash.digest();

    parts.push(":");
    parts.push(this.#previousHash.toString("hex").substr(0, HASH_LENGTH));
    parts.push("\n");

    return parts.join("");
  }

  #responseOnEnd(): void {
    if ( ! this.#abort) {
      this.#sendLine("D", this.#buffer);
      this.#sendLine("E", null);
    }
    this.#onEndEmitter.fire(undefined);
  }

  abort(): void {
    this.#abort = true;
    this.#sendLine("A", null);
  }
}
