/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as ThemeTypes from '../theme/Theme';
import * as DomUtils from './DomUtils';
import * as ThemeConsumer from '../theme/ThemeConsumer';
import * as ResizeRefreshElementBase from './ResizeRefreshElementBase';

/**
 * A base class for HTMLElements which also want theming CSS support.
 */
export class ThemeableElementBase extends ResizeRefreshElementBase.ResizeRefreshElementBase implements ThemeTypes.Themeable {

  static ID_THEME = "__ID_THEMEABLE_ELEMENT_BASE_STYLE__";

  private _themeTimeStamp = -1;

  /**
   * See `ThemeTypes.Themeable.setThemeCssMap()`
   */
  setThemeCssMap(cssMap: ThemeTypes.CssFileMap, themeTimeStamp: number): void {
    if (DomUtils.getShadowRoot(this) === null) {
      return;
    }
    
    const themeElement = (<HTMLStyleElement> DomUtils.getShadowId(this, ThemeableElementBase.ID_THEME));
    if (themeElement === null) {
      return;
    }
    const cssText = this._themeCssFiles().map( (cssFile) => cssMap.get(cssFile) ).join("\n");
    themeElement.textContent = cssText;
    this._themeTimeStamp = themeTimeStamp;
  }

  /**
   * Custom Element 'connected' life cycle hook.
   */
  protected connectedCallback(): void {
    ThemeConsumer.registerThemeable(this);

    if (ThemeConsumer.currentThemeTimeStamp() > this._themeTimeStamp) {
      this.installThemeCss();
    }
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
    this.setThemeCssMap(ThemeConsumer.cssMap(), ThemeConsumer.currentThemeTimeStamp());
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
