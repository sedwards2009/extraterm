// Type definitions for icepick 0.5.0
// Project: https://github.com/aearly/icepick
// Definitions by: Simon Edwards <simon@simonzone.com>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

declare module 'icepick' {
  function freeze(collection: Object|any[]): void;
  function thaw<T>(collection: T): T;
  function assoc<T>(collection: T, key: string|number, value: any): T;
  function dissoc<T>(collection: T, key: string|number);
  function assocIn<T>(collection: T, path: (string|number)[], value: any): T;
  function getIn<T>(collection: T, path: (string|number)[]): T;
  function updateIn<T>(collection: T, path: (string|number)[], callback: (old: T) => T): T;
  function assign<T>(collection: T, ...others: T[]): T;
  function extend<T>(collection: T, ...others: T[]): T;
  function merge<T>(target: T, source: T): T;
  
  function push<T>(collection: T[], a: T): T[];
  function pop<T>(collection: T[]): T[];
  function shift<T>(collection: T[], a: T): T[];
  function unshift<T>(collection: T[], a: T): T[];
  function reverse<T>(collection: T[]): T[];
  
  function sort<T>(collection: T[], compareFn?: (a: T, b: T) => number): T[];

  function splice<T>(collection: T[], start: number): T[];
  function splice<T>(collection: T[], start: number, deleteCount: number, ...items: T[]): T[];

  function map<T,U>(callbackfn: (value: T, index: number, array: T[]) => U, collection: T[]): U[];
  function filter<T>(callbackfn: (value: T, index: number, array: T[]) => boolean, collection: T[]): T[];
}
