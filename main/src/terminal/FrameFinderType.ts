/*
 * Copyright 2014-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { BulkFile } from '../bulk_file_handling/BulkFile';


/**
 * Given a frame ID, this locates and returns the coresponding content if found.
 */
export interface FrameFinder {
  (frameId: string): BulkFile;
}
