/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Generic type for making a type readonly and its fields, recursively.
// This only supports Json types and bans a couple of common types which don't translate to Json.
export type DeepReadonly<T> =
  T extends [infer A] ? DeepReadonlyObject1<[A]> :
  T extends [infer A, infer B] ? DeepReadonlyObject1<[A, B]> :
  T extends [infer A, infer B, infer C] ? DeepReadonlyObject1<[A, B, C]> :
  T extends [infer A, infer B, infer C, infer D] ? DeepReadonlyObject1<[A, B, C, D]> :
  T extends [infer A, infer B, infer C, infer D, infer E] ? DeepReadonlyObject1<[A, B, C, D, E]> :
  T extends Array<infer U> ? ReadonlyArray<DeepReadonlyObject1<U>> :
  T extends Map<infer U, infer V> ? ReadonlyMap<DeepReadonlyObject1<U>, DeepReadonlyObject1<V>> :
  T extends Set<infer U> ? ReadonlySet<DeepReadonlyObject1<U>> :
  T extends object ? DeepReadonlyObject1<T> :
  T;

export type DeepReadonlyObject1<T> = { readonly [K in keyof T]: DeepReadonly1<T[K]> };

export type DeepReadonly1<T> =
  T extends [infer A] ? DeepReadonlyObject2<[A]> :
  T extends [infer A, infer B] ? DeepReadonlyObject2<[A, B]> :
  T extends [infer A, infer B, infer C] ? DeepReadonlyObject2<[A, B, C]> :
  T extends [infer A, infer B, infer C, infer D] ? DeepReadonlyObject2<[A, B, C, D]> :
  T extends [infer A, infer B, infer C, infer D, infer E] ? DeepReadonlyObject2<[A, B, C, D, E]> :
  T extends Array<infer U> ? ReadonlyArray<DeepReadonlyObject2<U>> :
  T extends Map<infer U, infer V> ? ReadonlyMap<DeepReadonlyObject2<U>, DeepReadonlyObject2<V>> :
  T extends Set<infer U> ? ReadonlySet<DeepReadonlyObject2<U>> :
  T extends object ? DeepReadonlyObject2<T> :
  T;

export type DeepReadonlyObject2<T> = { readonly [K in keyof T]: DeepReadonly2<T[K]> };

export type DeepReadonly2<T> =
  T extends [infer A] ? DeepReadonlyObject3<[A]> :
  T extends [infer A, infer B] ? DeepReadonlyObject3<[A, B]> :
  T extends [infer A, infer B, infer C] ? DeepReadonlyObject3<[A, B, C]> :
  T extends [infer A, infer B, infer C, infer D] ? DeepReadonlyObject3<[A, B, C, D]> :
  T extends [infer A, infer B, infer C, infer D, infer E] ? DeepReadonlyObject3<[A, B, C, D, E]> :
  T extends Array<infer U> ? ReadonlyArray<DeepReadonlyObject3<U>> :
  T extends Map<infer U, infer V> ? ReadonlyMap<DeepReadonlyObject3<U>, DeepReadonlyObject3<V>> :
  T extends Set<infer U> ? ReadonlySet<DeepReadonlyObject3<U>> :
  T extends object ? DeepReadonlyObject3<T> :
  T;

export type DeepReadonlyObject3<T> = { readonly [K in keyof T]: DeepReadonly3<T[K]> };

export type DeepReadonly3<T> =
  T extends [infer A] ? DeepReadonlyObject4<[A]> :
  T extends [infer A, infer B] ? DeepReadonlyObject4<[A, B]> :
  T extends [infer A, infer B, infer C] ? DeepReadonlyObject4<[A, B, C]> :
  T extends [infer A, infer B, infer C, infer D] ? DeepReadonlyObject4<[A, B, C, D]> :
  T extends [infer A, infer B, infer C, infer D, infer E] ? DeepReadonlyObject4<[A, B, C, D, E]> :
  T extends Array<infer U> ? ReadonlyArray<DeepReadonlyObject4<U>> :
  T extends Map<infer U, infer V> ? ReadonlyMap<DeepReadonlyObject4<U>, DeepReadonlyObject4<V>> :
  T extends Set<infer U> ? ReadonlySet<DeepReadonlyObject4<U>> :
  T extends object ? DeepReadonlyObject4<T> :
  T;

export type DeepReadonlyObject4<T> = { readonly [K in keyof T]: T[K] };


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
