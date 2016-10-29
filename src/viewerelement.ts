/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import fs  = require('fs');
import util = require('./gui/util');
import virtualscrollarea = require('./virtualscrollarea');
import ViewerElementTypes = require('./viewerelementtypes');
import ThemeableElementBase = require('./themeableelementbase');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type SetterState = virtualscrollarea.SetterState;
type Mode = ViewerElementTypes.Mode;
type VisualState = ViewerElementTypes.VisualState;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;

abstract class ViewerElement extends ThemeableElementBase implements VirtualScrollable {
  
  static EVENT_BEFORE_SELECTION_CHANGE = "before-selection-change"

  static EVENT_CURSOR_MOVE = "cursor-move";

  static EVENT_CURSOR_EDGE = "cursor-edge";

  /**
   * Type guard for detecting a ViewerElement instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtCodeMirrorViewer.
   */
  static isViewerElement(node: Node): node is ViewerElement {
    return node !== null && node !== undefined && node instanceof ViewerElement;
  }
  
  get title(): string {
    return "ViewerElement";
  }
  
  hasFocus(): boolean {
    return false;
  }
  
  /**
   * Name of a Font Awesome icon to represent this viewer.
   */
  get awesomeIcon(): string {
    return "desktop";
  }
  
  /**
   * Gets the selected text.
   *
   * @return the selected text or null if there is no selection.
   */
  getSelectionText(): string {
    return null;
  }
  
  clearSelection(): void {
  }
 
  get focusable(): boolean {
    return false;
  }
  
  set focusable(value: boolean) {
  }
  
  abstract getVisualState(): VisualState;

  abstract setVisualState(state: VisualState): void;
  
  abstract getMode(): Mode;
  
  abstract setMode(mode: Mode): void;

  public text: string;
  
  public mimeType: string;
  
  public editable: boolean;
    
  // VirtualScrollable
  getMinHeight(): number {
    return 0;
  }

  // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    return 0;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    return 0;
  }
  
  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
  }

  getCursorPosition(): CursorMoveDetail {
    return {
      left: 0,
      top: 0,
      bottom: 0,
      viewPortTop: 0
    };
  }
   
  setCursorPositionBottom(x: number): boolean {
    return false;
  }
  
  setCursorPositionTop(x: number): boolean {
    return false;
  }
  
  setBytes(buffer: Buffer, mimeType: string): void {
    
  }
}

export = ViewerElement;
