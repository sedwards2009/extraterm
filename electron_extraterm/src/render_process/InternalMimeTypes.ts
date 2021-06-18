/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */


export const ElementMimeType = {
  MIMETYPE: "application/x-extraterm-element",

  equals(mimeType: string, windowId: string): boolean {
    return mimeTypeEquals(ElementMimeType.MIMETYPE, mimeType, windowId);
  },

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
  },

  dataTransferGetData(dataTransfer: DataTransfer, windowId: string): string {
    return dataTransferGetData(ElementMimeType, dataTransfer, windowId);
  }
};


export const FrameMimeType = {
  MIMETYPE: "application/x-extraterm-frame",

  equals(mimeType: string, windowId: string): boolean {
    return mimeTypeEquals(FrameMimeType.MIMETYPE, mimeType, windowId);
  },

  dataTransferGetData(dataTransfer: DataTransfer, windowId: string): string {
    return dataTransferGetData(FrameMimeType, dataTransfer, windowId);
  }
};

function mimeTypeEquals(baseMimeType: string, mimeType: string, windowId: string): boolean {
  const parts = mimeType.split(";");
  const hasWindowId = parts.length !== 1 && parts[1].startsWith("windowid=");
  if (windowId != null && hasWindowId) {
    return `${baseMimeType};windowid=${windowId}` === mimeType;
  } else {
    return baseMimeType === parts[0];
  }
}

function dataTransferGetData(
    mimeType: { equals(mimeType: string, windowId: string): boolean; },
    dataTransfer: DataTransfer,
    windowId: string): string {

  for (let i=0; i < dataTransfer.items.length; i++) {
    const item = dataTransfer.items[i];
    if (mimeType.equals(item.type, windowId)) {
      return dataTransfer.getData(item.type);
    }
  }
  return null;
}
