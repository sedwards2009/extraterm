/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import fs  = require('fs');
import globalcss = require('./gui/globalcss');
import util = require('./gui/util');
import virtualscrollarea = require('./virtualscrollarea');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;

class ViewerElement extends HTMLElement implements VirtualScrollable {
  
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
  
  get focusable(): boolean {
    return false;
  }
  
  set focusable(value: boolean) {
  }
  
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
  
}

export = ViewerElement;
