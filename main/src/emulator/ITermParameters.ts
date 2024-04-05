/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ControlSequenceParameters } from "./FastControlSequenceParameters";
import { log, Logger, getLogger } from "extraterm-logging";

const FILE_PREFIX = "File=";
const MAX_FILE_SIZE = 1024 * 1024 * 128;

const BUFFER_CHUNK_SIZE = 4 * 3 * 1024 * 10;  // Make this too big and String.fromCharCode() will fail.

export class ITermParameters {
  private _log: Logger = null;

  #isFile = false;
  #expectedPayloadLength = -1;
  #encodedPayloadParts: Uint8Array[] = [];
  #lastPayloadIndex = 0;

  #width = "auto";
  #height = "auto";
  #preserveAspectRatio = true;

  constructor(params: ControlSequenceParameters) {
    this._log = getLogger("ITermParameters", this);
    this.#parseParameters(params);
  }

  #parseParameters(params: ControlSequenceParameters): void {
    for (let i=0; i<params.getParamCount(); i++) {
      let paramString = params.getParameterString(i);

      if (i === 1 && paramString.startsWith(FILE_PREFIX)) {
        this.#isFile = true;
        paramString = paramString.slice(FILE_PREFIX.length);
      }

      const parts = paramString.split("=", 2);
      if (parts.length !== 2) {
        continue;
      }

      switch (parts[0]) {
        case "name":
          break;

        case "size":
          const expectedPayloadLength = Number.parseInt(parts[1], 10);
          this._log.info(`expectedPayloadLength: ${expectedPayloadLength}`);
          if (isNaN(expectedPayloadLength) || expectedPayloadLength < 0 || expectedPayloadLength > MAX_FILE_SIZE) {
            this._log.warn(`Invalid 'size' parameter given. Received '${parts[1]}'`);
            this.#expectedPayloadLength = -1;
          } else {
            this.#expectedPayloadLength = expectedPayloadLength;
          }
          break;

        case "width":
          this.#width = parts[1];
          break;

        case "height":
          this.#height = parts[1];
          break;

        case "preserveAspectRatio":
          this.#preserveAspectRatio = parts[1] === "1";
          break;

        case "inline":
          break;

        default:
          this._log.warn(`Unknown paramater key '${parts[0]}'.`);
          break;
      }
    }
  }

  getExpectedPayloadLength(): number {
    return this.#expectedPayloadLength;
  }

  #getPayloadLength(): number {
    return this.#encodedPayloadParts.length * BUFFER_CHUNK_SIZE + this.#lastPayloadIndex;
  }

  getWidth(): string {
    return this.#width;
  }

  getHeight(): string {
    return this.#height;
  }

  getPreserveAspectRatio(): boolean {
    return this.#preserveAspectRatio;
  }

  appendPayloadCodePoint(codePoint: number): boolean {
    if (this.#getPayloadLength() > MAX_FILE_SIZE) {
      this._log.warn(`Received too many chars for payload. Received ${this.#getPayloadLength()}`);
      return false;
    }

    if (this.#encodedPayloadParts.length === 0) {
      this.#encodedPayloadParts.push(new Uint8Array(BUFFER_CHUNK_SIZE));
    }

    this.#encodedPayloadParts[this.#encodedPayloadParts.length -1][this.#lastPayloadIndex] = codePoint;

    this.#lastPayloadIndex++;
    if (this.#lastPayloadIndex >= BUFFER_CHUNK_SIZE) {
      this.#encodedPayloadParts.push(new Uint8Array(BUFFER_CHUNK_SIZE));
      this.#lastPayloadIndex = 0;
    }

    return true;
  }

  getPayload(): Buffer {
    if (this.#encodedPayloadParts.length === 0) {
      return Buffer.alloc(0);
    }
    const payloadParts = this.#encodedPayloadParts;
    const parts = payloadParts.slice(0, payloadParts.length-1).map(buf => {
      const base64String = String.fromCharCode(...buf);
      return Buffer.from(base64String, "base64");
    });

    const base64String = String.fromCharCode(...payloadParts[payloadParts.length-1].slice(0, this.#lastPayloadIndex));
    parts.push(Buffer.from(base64String, "base64"));
    return Buffer.concat(parts);
  }
}
