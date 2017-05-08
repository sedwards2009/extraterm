/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as ThemeTypes from './Theme';
import * as DomUtils from './DomUtils';
import * as ThemeConsumer from './ThemeConsumer';
import * as ResizeRefreshElementBase from './ResizeRefreshElementBase';

/**
 * A base class for HTMLElements which also want theming CSS support.
 */
export class ThemeableElementBase extends ResizeRefreshElementBase.ResizeRefreshElementBase implements ThemeTypes.Themeable {

  static ID_THEME = "ID_THEME";

  /**
   * See `ThemeTypes.Themeable.setThemeCssMap()`
   */
  setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {
    if (DomUtils.getShadowRoot(this) === null) {
      return;
    }
    
    const themeElement = (<HTMLStyleElement> DomUtils.getShadowId(this, ThemeableElementBase.ID_THEME));
    if (themeElement === null) {
      return;
    }
    const cssText = this._themeCssFiles().map( (cssFile) => cssMap.get(cssFile) ).join("\n");
    themeElement.textContent = cssText;
  }

  /**
   * Custom Element 'connected' life cycle hook.
   */
  protected connectedCallback(): void {
    ThemeConsumer.registerThemeable(this);
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  protected disconnectedCallback(): void {
    ThemeConsumer.unregisterThemeable(this);
  }

  /**
   * Updates the style element's CSS contents.
   */
  protected installThemeCss(): void {
    this.setThemeCssMap(ThemeConsumer.cssMap());
  }

  /**
   * Updates the Style element's CSS contents immediately and forces a refresh.
   */
  protected updateThemeCss(): void {
    this.installThemeCss();
    this.refresh(ResizeRefreshElementBase.RefreshLevel.COMPLETE);
  }
  
  /**
   * Gets the list of CssFiles this element requires for its CSS theming.
   *
   * Subclasses should override this method.
   *
   * @returns the list of CssFiles
   */
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [];
  }
}
