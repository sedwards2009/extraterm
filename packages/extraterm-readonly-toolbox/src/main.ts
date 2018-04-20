/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Generic type for making a type readonly and its fields, recursively.
// This only supports Json types and bans a couple of common types which don't translate to Json.
export type DeepReadonly<T> =
  T extends [infer A] ? DeepReadonlyObject<[A]> :
  T extends [infer A, infer B] ? DeepReadonlyObject<[A, B]> :
  T extends [infer A, infer B, infer C] ? DeepReadonlyObject<[A, B, C]> :
  T extends [infer A, infer B, infer C, infer D] ? DeepReadonlyObject<[A, B, C, D]> :
  T extends [infer A, infer B, infer C, infer D, infer E] ? DeepReadonlyObject<[A, B, C, D, E]> :
  T extends Array<infer U> ? ReadonlyArray<DeepReadonlyObject<U>> :
  T extends Map<infer U, infer V> ? ReadonlyMap<DeepReadonlyObject<U>, DeepReadonlyObject<V>> :
  T extends Set<infer U> ? ReadonlySet<DeepReadonlyObject<U>> :
  T extends object ? DeepReadonlyObject<T> :
  T;

export type DeepReadonlyObject<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> }

export function freezeDeep<A>(thing: A): A {
  if (Object.isFrozen(thing)) {
    return thing;
  }

  Object.freeze(thing);

  for (const prop of Object.getOwnPropertyNames(thing)) {
    freezeDeep(thing[prop]);
  }
  return thing;
}
