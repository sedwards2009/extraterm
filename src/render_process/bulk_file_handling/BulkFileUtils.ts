/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {BulkFileHandle} from './BulkFileHandle';
import * as MimeTypeDetector from '../../mimetype_detector/MimeTypeDetector';


export function guessMimetype(bulkFileHandle: BulkFileHandle): {mimeType: string, charset:string} {

  const buffer = bulkFileHandle.peek1KB();
  const metadata = bulkFileHandle.getMetadata();
  const filename = "" + metadata.filename;

  let mimeType: string = metadata.mimeType == null ? null : "" + metadata.mimeType;
  let charset: string = metadata.charset == null ? null : "" + metadata.charset;
  if (mimeType === null) {
    // Try to determine a mimetype by inspecting the file name first.
    const detectionResult = MimeTypeDetector.detect(filename, buffer);
    if (detectionResult !== null) {
      mimeType = detectionResult.mimeType;
      if (charset === null) {
        charset = detectionResult.charset;
      }
    }
  }
  return {mimeType, charset};
}

/**
 * Async read the contents of a Bulk File Handle.
 */
export function readDataAsArrayBuffer(bulkFileHandle: BulkFileHandle): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", bulkFileHandle.getUrl(), true);
    xhr.responseType = "arraybuffer";
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send();
  });  
}
