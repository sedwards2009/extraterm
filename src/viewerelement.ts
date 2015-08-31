/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import fs  = require('fs');
import globalcss = require('./gui/globalcss');
import util = require('./gui/util');

class ViewerElement extends HTMLElement {
  
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
  
  /**
   * Name of a Font Awesome icon to represent this viewer.
   */
  get awesomeIcon(): string {
    return "desktop";
  }
  
  getSelectionText(): string {
    return null;
  }
}

export = ViewerElement;
