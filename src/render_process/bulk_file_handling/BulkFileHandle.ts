/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {Metadata} from '../../main_process/bulk_file_handling/BulkFileStorage';


export interface BulkFileHandle {
  getUrl(): string;
  getSize(): number;
  getMetadata(): Metadata;
  ref(): void;
  deref(): void;
}
