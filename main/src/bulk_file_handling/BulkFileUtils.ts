/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as MimeTypeDetector from 'extraterm-mimetype-detector';
import { BulkFile } from './BulkFile.js';


export function guessMimetype(bulkFileHandle: BulkFile): {mimeType: string, charset:string} {
  const buffer = bulkFileHandle.getPeekBuffer();
  const metadata = bulkFileHandle.getMetadata();
  return MimeTypeDetector.detectWithMetadata(metadata, buffer);
}
