// Type definitions for jschardet v1.4.1
// Project: https://github.com/aadsm/jschardet
// Definitions by: Simon Edwards <https://github.com/sedwards2009>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
declare module "jschardet" {
  interface Result {
    encoding: string;
    confidence: number;
  }

  function detect(str: string): Result;
}
