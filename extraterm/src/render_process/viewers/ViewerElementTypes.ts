/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export enum Mode {
  DEFAULT,  // The default mode when using Extraterm. Default terminal like behaviour.
  CURSOR    // Mode for using the cursor and selecting or editing parts of the output.
};

export enum VisualState {
  AUTO,      // "Visual state should automatically follow the focus."
  UNFOCUSED, // "Visual state should appear in the unfocused state."
  FOCUSED    // "Visual state should appear in the focused state."
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

// Class objects can implement this interface as a set of static properties/methods.
export interface SupportsMimeTypes {
  TAG_NAME: string;
  supportsMimeType(mimeType): boolean;
}

export enum RefreshLevel {
  COMPLETE,
  RESIZE
}
