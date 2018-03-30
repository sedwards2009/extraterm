/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import * as Electron from 'electron';
const shell = Electron.shell;
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as he from 'he';
import * as SourceDir from '../../SourceDir';
import {WebComponent} from 'extraterm-web-component-decorators';
import {ViewerMetadata, Disposable} from 'extraterm-extension-api';

import * as config from '../../Config';
type ConfigManager = config.ConfigDistributor;

import * as keybindingmanager from '../keybindings/KeyBindingManager';
type KeyBindingManager = keybindingmanager.KeyBindingManager;

import {ViewerElement} from '../viewers/ViewerElement';
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as Util from '../gui/Util';
import * as DomUtils from '../DomUtils';
import * as ViewerElementTypes from '../viewers/ViewerElementTypes';
import * as VirtualScrollArea from '../VirtualScrollArea';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type SetterState = VirtualScrollArea.SetterState;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;
type VisualState = ViewerElementTypes.VisualState;
const VisualState = ViewerElementTypes.VisualState;

const ID = "EtTipViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CONTENT = "ID_CONTENT";
const ID_CONTROLS = "ID_CONTROLS";
const ID_PREVIOUS_BUTTON = "ID_PREVIOUS_BUTTON";
const ID_NEXT_BUTTON = "ID_NEXT_BUTTON";
const ID_SHOW_TIPS = "ID_SHOW_TIPS";
const CLASS_KEYCAP = "CLASS_KEYCAP";

const KEYBINDINGS_SELECTION_MODE = "image-viewer";

const DEBUG_SIZE = false;

let instanceIdCounter = 0;

/**
 * Load in the array of tips from src/tips/tips.html.
 *
 * Each separate tip in the HTML file must be enclosed by an article tag.
 * @return the array of tip HTMLs.
 */
function loadTipFile(): string[] {
  const tipPath = path.join(SourceDir.path, "../resources/tips/tips.html");
  const tipHtml = fs.readFileSync(tipPath, {encoding: 'utf8'});
  
  const parts = tipHtml.split(/<article>([^]*?)<\/article>/m);
  return parts.filter( (p, i) => {
    return i % 2 === 1;
  });  
}

const tipData = loadTipFile();

@WebComponent({tag: "et-tip-viewer"})
export class TipViewer extends ViewerElement implements config.AcceptsConfigDistributor, keybindingmanager.AcceptsKeyBindingManager {

  static TAG_NAME = "ET-TIP-VIEWER";
  
  static MIME_TYPE = "application/x-extraterm-tip";
  
  /**
   * Type guard for detecting a EtTipViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTipViewer.
   */
  static is(node: Node): node is TipViewer {
    return node !== null && node !== undefined && node instanceof TipViewer;
  }
  
  private _log: Logger;
  private _configManager: ConfigManager = null;
  private _keyBindingManager: KeyBindingManager = null;
  private _height = 0;
  private _tipIndex = 0;
  private _configManagerDisposable: Disposable = null;

  constructor() {
    super();
    this._log = getLogger(TipViewer.TAG_NAME, this);
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Tip";
    metadata.icon = "lightbulb-o";
    return metadata;
  }
  
  connectedCallback(): void {
    super.connectedCallback();
    this._tipIndex = this._configManager.getConfig().tipCounter % this._getTipCount();
    
    if (DomUtils.getShadowRoot(this) !== null) {
      return;
    }
    
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    
    // Intercept link clicks and open them in an external browser.
    containerDiv.addEventListener('click', (ev: MouseEvent) => {
      const source = <HTMLElement> ev.target;
      if (source.tagName === "A") {
        ev.preventDefault();
        shell.openExternal((<HTMLAnchorElement> source).href);
      }
    });
    
    containerDiv.addEventListener('focus', (ev: FocusEvent) => {
      if (ev.target instanceof HTMLSelectElement) {
        ev.stopPropagation();
        return;
      }
    }, true);

    this._setTipHTML(this._getTipHTML(this._tipIndex));
    
    const nextButton = DomUtils.getShadowId(this, ID_NEXT_BUTTON);
    nextButton.addEventListener('click', () => {
      this._tipIndex = (this._tipIndex + 1) % this._getTipCount();
      this._setTipHTML(this._getTipHTML(this._tipIndex));
    });
    
    const previousButton = DomUtils.getShadowId(this, ID_PREVIOUS_BUTTON);
    previousButton.addEventListener('click', () => {
      this._tipIndex = (this._tipIndex + this._getTipCount() - 1) % this._getTipCount();
      this._setTipHTML(this._getTipHTML(this._tipIndex));
    });
    
    const showTipsSelect = <HTMLSelectElement> DomUtils.getShadowId(this, ID_SHOW_TIPS);
    showTipsSelect.value = this._configManager.getConfig().showTips;
    showTipsSelect.addEventListener('change', () => {
      const newConfig = _.cloneDeep(this._configManager.getConfig());
      newConfig.showTips = <config.ShowTipsStrEnum> showTipsSelect.value;
      this._configManager.setConfig(newConfig);
    });
  }
  
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._configManagerDisposable !== null) {
      this._configManagerDisposable.dispose();
      this._configManagerDisposable = null;
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TIP_VIEWER, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GUI_CONTROLS];
  }

  setConfigDistributor(newConfigManager: ConfigManager): void {
    if (this._configManagerDisposable !== null) {
      this._configManagerDisposable.dispose();
      this._configManagerDisposable = null;
    }
    
    this._configManager = newConfigManager;
    if (this._configManager !== null) {
      this._configManagerDisposable = this._configManager.onChange(this._configChanged.bind(this));
    }
  }

  setKeyBindingManager(newKeyBindingManager: KeyBindingManager): void {
    if (this._keyBindingManager !== null) {
      this._keyBindingManager.unregisterChangeListener(this);
    }
    
    this._keyBindingManager = newKeyBindingManager;
    if (this._keyBindingManager !== null) {
      this._keyBindingManager.registerChangeListener(this, this._keyBindingChanged.bind(this));
    }
  }
  
  getSelectionText(): string {    
    return null;
  }

  focus(): void {
    if (DomUtils.getShadowRoot(this) === null) {
      return;
    }
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    DomUtils.focusWithoutScroll(containerDiv);
  }

  hasFocus(): boolean {
    const hasFocus = this === DomUtils.getShadowRoot(this).activeElement; // FIXME
    return hasFocus;
  }

  // VirtualScrollable
  getHeight(): number {
    return this._height;
  }
  
  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (DEBUG_SIZE) {
      this._log.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
        setterState.yOffset, setterState.yOffsetChanged);
    }
  }

  // VirtualScrollable
  getMinHeight(): number {
    return this._height;
  }

   // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._log.debug("getVirtualHeight: ", this._height);
    }
    return this._height;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }
  
  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return [TipViewer.MIME_TYPE].indexOf(mimeType) !== -1;
  }
  
  
  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    this._processRefresh(level);
  }

  private createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}">
        </style>
        <div id="${ID_CONTAINER}" class="container-fluid">
          <div id="${ID_CONTENT}"></div>
          <div id="${ID_CONTROLS}" class="form-inline">
            <div class="btn-group">
              <button id="${ID_PREVIOUS_BUTTON}" title="Previous Tip" class="btn btn-default btn-sm"><i class="fa fa-chevron-left" aria-hidden="true"></i></button>
              <button id="${ID_NEXT_BUTTON}" title="Next Tip" class="btn btn-default btn-sm"><i class="fa fa-chevron-right" aria-hidden="true"></i></button>
            </div>
            <div class="form-group form-group-sm">
              <label for="">Show tips: </label>
              <select id="${ID_SHOW_TIPS}" class="form-control">
                <option value="always">Everytime</option>
                <option value="daily">Daily</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
        </div>`;

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  private _configChanged(): void {
    const showTipsSelect = <HTMLSelectElement> DomUtils.getShadowId(this, ID_SHOW_TIPS);
    showTipsSelect.value = this._configManager.getConfig().showTips;  
  }

  private _keyBindingChanged(): void {
    this._setTipHTML(this._getTipHTML(this._tipIndex));
  }

  private _setTipHTML(html: string): void {
    const contentDiv = DomUtils.getShadowId(this, ID_CONTENT);
    contentDiv.innerHTML = html;

    this._substituteKeycaps(contentDiv);
    this._fixImgRelativeUrls(contentDiv);
    
    this._processRefresh(ResizeRefreshElementBase.RefreshLevel.RESIZE);
  }

  private _substituteKeycaps(contentDiv: HTMLElement): void {
    // Replace the kbd elements with the requested keyboard short cuts.
    const kbdElements = contentDiv.querySelectorAll("span."+CLASS_KEYCAP);
    DomUtils.toArray(kbdElements).forEach( (kbd) => {
      const dataContext = kbd.getAttribute("data-context");
      const dataCommand = kbd.getAttribute("data-command");
      if (dataContext !== null && dataCommand !== null) {
        const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(dataContext);
        if (keyBindings != null) {
          const shortcut = keyBindings.mapCommandToKeyBinding(dataCommand);
          if (shortcut !== null) {
            kbd.innerHTML = `<span>${he.encode(shortcut)}</span>`;
          } else {
            kbd.parentNode.removeChild(kbd);
          }
        }
      }      
    });
  }
  
  private _fixImgRelativeUrls(contentDiv: HTMLElement): void {
    const imgElements = contentDiv.querySelectorAll("img");
    const prefix = "file:///" + SourceDir.path + "/tips/";
    DomUtils.toArray(imgElements).forEach( (element) => {
      const img = <HTMLImageElement> element;
      img.src = prefix + img.getAttribute("src");
    });
  }

  private _processRefresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    if (containerDiv !== null) {
      // --- DOM Read ---
      const rect = containerDiv.getBoundingClientRect();
      this._height = rect.height;

      this._adjustHeight(this._height);
      VirtualScrollArea.emitResizeEvent(this);
    }
  }

  private _getTipHTML(tipNumber: number): string {
    return tipData[tipNumber];
  }
  
  private _getTipCount(): number {
    return tipData.length;
  }
  
  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || DomUtils.getShadowRoot(this) === null) {
      return;
    }
    this.style.height = "" + newHeight + "px";
  }
}
