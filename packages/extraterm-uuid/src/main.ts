/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { randomBytes } from "node:crypto";

/**
 * Create a UUID v4
 *
 * @return New cryptographcially secure UUID.
 */
export function createUuid(): string {
  const buffer = new Uint8Array(16);
  const buf = randomBytes(16);
  for (let i=0; i<16; i++) {
    buffer[i] = buf[i];
  }

  buffer[6] = (buffer[6] & 0x0f) | 0x40;
  buffer[8] = (buffer[8] & 0x3f) | 0x80;

  return byteToHex(buffer[0]) + byteToHex(buffer[1]) +
    byteToHex(buffer[2]) + byteToHex(buffer[3]) +
    "-" + byteToHex(buffer[4]) + byteToHex(buffer[5]) +
    "-" + byteToHex(buffer[6]) + byteToHex(buffer[7]) +
    "-" + byteToHex(buffer[8]) + byteToHex(buffer[9]) +
    "-" + byteToHex(buffer[10]) + byteToHex(buffer[11]) +
    byteToHex(buffer[12]) + byteToHex(buffer[13]) +
    byteToHex(buffer[14]) + byteToHex(buffer[15]);
}

function byteToHex(b: number): string {
  return (b + 0x100).toString(16).substr(1);
}
