/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { BulkFileHandle } from "./BulkFiles";
import { Tab } from "./Tab";
import { Terminal } from "./Terminal";


export enum ViewerPosture {
  NEUTRAL,
  RUNNING,
  SUCCESS,
  FAILURE,
}

export interface ViewerMetadata {
  title: string;
  icon: string;
  posture: ViewerPosture;
  moveable: boolean;
  deleteable: boolean;
  toolTip: string;
}

export type ViewerMetadataChange = { [K in keyof ViewerMetadata]?: ViewerMetadata[K] };

/**
 * Extensions which implement Viewer must subclass this.
 *
 * Note that TypeScript subclasses should not provide a constructor. Pure
 * JavaScript subclasses can have a constructor but it must pass all of
 * its arguments to the super class.
 */
export interface ExtensionViewerBase {

  /**
   * Extension writers can override method to perform set up and
   * initialisation after construction.
   */
  created(): void;

  /**
   * Get the container element under which this Viewer's contents can be placed.
   */
  getContainerElement(): HTMLElement;

  /**
   * Get the metadata describing this viewer.
   */
  getMetadata(): ViewerMetadata;

  /**
   * Change fields in the metadata.
   *
   * @param changes object containing the fields to change
   */
  updateMetadata(changes: ViewerMetadataChange): void;

  /**
   * Get a BulkFileHandle with the contents of this viewer.
   */
  getBulkFileHandle(): BulkFileHandle;

  /**
   *
   */
  setBulkFileHandle(handle: BulkFileHandle): Promise<void>;
}


export interface ExtensionViewerBaseConstructor {
  new(...any: any[]): ExtensionViewerBase;
}

export interface ViewerBase {
  /**
   * Get the tab which contains this viewer.
   */
  getTab(): Tab;

  /**
   * Get the terminal which contains this viewer.
   *
   * This may be null if the viewer is not inside a terminal.
   */
  getOwningTerminal(): Terminal;
}
