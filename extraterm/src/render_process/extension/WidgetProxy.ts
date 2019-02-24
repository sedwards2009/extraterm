/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ThemeableElementBase } from '../ThemeableElementBase';
import { Logger, getLogger } from "extraterm-logging";
import { CssFile } from '../../theme/Theme';
import { InternalExtensionContext } from './InternalTypes';
import { ExtensionCss } from '../../ExtensionMetadata';
import { WebComponent } from 'extraterm-web-component-decorators';

@WebComponent({tag: "et-extension-widget-proxy"})
export class WidgetProxy extends ThemeableElementBase  {

  static TAG_NAME = "et-extension-widget-proxy";

  private _log: Logger = null;
  private _doneSetup = false;

  private _extensionContext: InternalExtensionContext = null;
  private _extensionCss: ExtensionCss = null;
  private _styleElement: HTMLStyleElement = null;
  private _containerDivElement: HTMLDivElement = null;

  constructor() {
    super();
    this._log = getLogger("ExtensionWidgetProxy", this);
  }

  connectedCallback(): void {
    super.connectedCallback();
    if ( ! this._doneSetup) {
      this._doneSetup = true;
      this._setupDOM();
    }
  }

  private _setupDOM(): void {
    this.attachShadow({ mode: 'open', delegatesFocus: false });

    this._styleElement = document.createElement("style");
    this._styleElement.id = ThemeableElementBase.ID_THEME;
    this.shadowRoot.appendChild(this._styleElement);

    this._containerDivElement = document.createElement("div");
    this.shadowRoot.appendChild(this._containerDivElement);

    this.updateThemeCss();
  }

  /**
   * Get the node where the element's DOM nodes should be placed.
   */
  getContainerElement(): HTMLElement {
    return this._containerDivElement;
  }

  _setExtensionContext(extensionContext: InternalExtensionContext): void {
    this._extensionContext = extensionContext;
  }

  _setExtensionCss(extensionCss: ExtensionCss): void {
    this._extensionCss = extensionCss;
    this.updateThemeCss();
  }

  protected _themeCssFiles(): CssFile[] {
    const cssDecl = this._extensionCss;
    if (cssDecl != null && this._extensionContext != null) {
      const name = this._extensionContext.extensionMetadata.name;
      const cssFiles = cssDecl.cssFile.map(cf =>  name + ":" + cf);
      const fontAwesomeCss = cssDecl.fontAwesome ? [CssFile.FONT_AWESOME] : [];
      return [CssFile.GENERAL_GUI, ...fontAwesomeCss, ...cssFiles];
    }
    return [];
  }
}
