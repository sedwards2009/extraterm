/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import fs  = require('fs');
import globalcss = require('./gui/globalcss');
import util = require('./gui/util');
import virtualscrollarea = require('./virtualscrollarea');
import ViewerElementTypes = require('./viewerelementtypes');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type Mode = ViewerElementTypes.Mode;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;

abstract class ViewerElement extends HTMLElement implements VirtualScrollable {
  
  static VISUAL_STATE_AUTO = 0;     // "Visual state should automatically follow the focus."
  static VISUAL_STATE_UNFOCUSED = 1;// "Visual state should appear in the unfocused state."
  static VISUAL_STATE_FOCUSED = 2;  // "Visual state should appear in the focused state."
  
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

  private _themeCssPath: string;
  
  set themeCssPath(path: string) {
    this._themeCssPath = path;
    this._themeCssSet();
  }
  
  getThemeCss(): string {
    if (this._themeCssPath !== undefined) {
      const themeCss = fs.readFileSync(this._themeCssPath, {encoding: 'utf8'});
      return globalcss.stripFontFaces(themeCss);
    } else {
      return null;
    }
  }
  
  _themeCssSet(): void {
    
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
  
  public visualState: number;
  // One of the constants VISUAL_STATE_AUTO, VISUAL_STATE_UNFOCUSED, VISUAL_STATE_FOCUSED 
  
  public mode: Mode;
  
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
  setHeight(height: number): void {
    
  }
  
  // VirtualScrollable
  setScrollOffset(y: number): void {
    
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
}

export = ViewerElement;
