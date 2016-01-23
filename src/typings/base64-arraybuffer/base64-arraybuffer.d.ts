// Type definitions for base64-arraybuffer v0.1.5
// Project: https://github.com/niklasvh/base64-arraybuffer
// Definitions by: Simon Edwards <https://github.com/sedwards2009>

declare module "base64-arraybuffer" {
  interface Base64ArrayBufferStatic {
    encode(buffer: ArrayBuffer): string;
    decode(str: string): ArrayBuffer;
  }
  var Base64ArrayBufferStatic: Base64ArrayBufferStatic;
  export = Base64ArrayBufferStatic;
}
