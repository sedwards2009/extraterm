/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';

import { ThemeableElementBase } from '../ThemeableElementBase';
import { Logger, getLogger } from "extraterm-logging";
import { CssFile } from '../../theme/Theme';
import { InternalExtensionContext } from './InternalTypes';
import { ExtensionCss } from '../../ExtensionMetadata';
import { CustomElement } from 'extraterm-web-component-decorators';

/**
 * Custom element used to host an isolated DOM subtree from an extension.
 */
@CustomElement("et-extension-container-element")
export class ExtensionContainerElement extends ThemeableElementBase  {

  static TAG_NAME = "et-extension-container-element";

  private _log: Logger = null;
  private _doneSetup = false;

  private _extensionContext: InternalExtensionContext = null;
  private _extensionCss: ExtensionCss = null;
  private _containerDivElement: HTMLDivElement = null;

  constructor() {
    super();
    this._log = getLogger("ExtensionContainerElement", this);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._setup();
  }

  private _setup(): void {
    if ( ! this._doneSetup) {
      this._doneSetup = true;
      this._setupDOM();
    }
  }

  private _setupDOM(): void {
    this.attachShadow({ mode: 'open', delegatesFocus: false });

    const styleElement = document.createElement("style");
    styleElement.id = ThemeableElementBase.ID_THEME;
    this.shadowRoot.appendChild(styleElement);

    this._containerDivElement = document.createElement("div");
    this.shadowRoot.appendChild(this._containerDivElement);

    this.updateThemeCss();
  }

  /**
   * Get the node where the element's DOM nodes should be placed.
   */
  getContainerElement(): HTMLElement {
    this._setup();
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
      const name = this._extensionContext._extensionMetadata.name;
      const cssFiles = cssDecl.cssFile.map(cf =>  name + ":" + path.join(cssDecl.directory, cf));
      const fontAwesomeCss = cssDecl.fontAwesome ? [CssFile.FONT_AWESOME] : [];
      return [CssFile.GENERAL_GUI, ...fontAwesomeCss, ...cssFiles];
    }
    return [];
  }
}
