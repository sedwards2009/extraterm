/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

export enum Mode {
  DEFAULT,  // The default mode when using Extraterm. Default terminal like behaviour.
  SELECTION // Mode for selecting parts of the output using the cursor.
};

export interface CursorMoveDetail {
  left: number;
  top: number;
  bottom: number;
  viewPortTop: number;
};

export enum Edge {
  TOP,
  BOTTOM
};

export interface CursorEdgeDetail {
  edge: Edge;
  ch: number;
};
