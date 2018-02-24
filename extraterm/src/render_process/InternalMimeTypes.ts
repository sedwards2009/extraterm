/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */


export const ElementMimeType = {
  MIMETYPE: "application/x-extraterm-element",

  elementToData(el: Element): string {
    return el.tagName + " " + el.id;
  },

  elementIdFromData(data: string): string {
    const parts = data.split(" ");
    return parts[1];
  },

  tagNameFromData(data: string): string {
    const parts = data.split(" ");
    return parts[0];
  }
};


export const FrameMimeType = {
  MIMETYPE: "application/x-extraterm-frame",  
};
