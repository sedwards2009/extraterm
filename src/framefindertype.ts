/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

/**
 * Given a frame ID, this locates and returns the coresponding content if found.
 */
export interface FrameFinder {
  (frameId: string): string;
}
