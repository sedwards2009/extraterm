/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export const MIMETYPE_ELEMENT = "application/x-extraterm-element";

export function elementToData(el: Element): string {
  return el.tagName + " " + el.id;
}

export function elementIdFromData(data: string): string {
  const parts = data.split(" ");
  return parts[1];
}

export function tagNameFromData(data: string): string {
  const parts = data.split(" ");
  return parts[0];
}
