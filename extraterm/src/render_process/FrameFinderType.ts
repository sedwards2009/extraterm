/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

 import {BulkFileHandle} from './bulk_file_handling/BulkFileHandle';

/**
 * Given a frame ID, this locates and returns the coresponding content if found.
 */
export interface FrameFinder {
  (frameId: string): BulkFileHandle;
}
