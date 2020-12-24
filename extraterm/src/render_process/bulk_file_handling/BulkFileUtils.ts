/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { BulkFileHandle } from '@extraterm/extraterm-extension-api';
import * as MimeTypeDetector from 'extraterm-mimetype-detector';


export function guessMimetype(bulkFileHandle: BulkFileHandle): {mimeType: string, charset:string} {
  const buffer = bulkFileHandle.peek1KB();
  const metadata = bulkFileHandle.metadata;
  return MimeTypeDetector.detectWithMetadata(metadata, buffer);
}

/**
 * Async read the contents of a Bulk File Handle.
 */
export function readDataAsArrayBuffer(bulkFileHandle: BulkFileHandle): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", bulkFileHandle.url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send();
  });
}
