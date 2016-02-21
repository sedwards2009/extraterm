/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

declare module 'utf8' {
  
  interface Stringish {
    charCodeAt(index: number): number;
    length: number;
  }
  
  function encode(str: string): string;
  function decode(str: Stringish): string;
}
