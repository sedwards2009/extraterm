/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

export interface TextDecoration {
  line: number;
  fromCh: number;
  toCh: number;
  classList: string[];
}

export interface BookmarkRef {
  bookmarkRefId: number;
}
