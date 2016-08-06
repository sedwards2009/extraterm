/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import electron = require('electron');
const shell = electron.shell;
import _  = require('lodash');
import fs = require('fs');
import path = require('path');
import he = require('he');
import sourceDir = require('../sourceDir');

import config = require('../config');
type ConfigManager = config.ConfigManager;

import keybindingmanager = require('../keybindingmanager');
type KeyBindingManager = keybindingmanager.KeyBindingManager;

import ViewerElement = require("../viewerelement");
import ThemeableElementBase = require('../themeableelementbase');
import ThemeTypes = require('../theme');
import util = require("../gui/util");
import domutils = require("../domutils");
import ViewerElementTypes = require('../viewerelementtypes');
import virtualscrollarea = require('../virtualscrollarea');
import Logger = require('../logger');
import LogDecorator = require('../logdecorator');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type SetterState = virtualscrollarea.SetterState;
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

const DEBUG_SIZE = true;

const log = LogDecorator;

let registered = false;
let instanceIdCounter = 0;

/**
 * Load in the array of tips from src/tips/tips.html.
 *
 * Each separate tip in the HTML file must be enclosed by an article tag.
 * @return the array of tip HTMLs.
 */
function loadTipFile(): string[] {
  const tipPath = path.join(sourceDir.path, "tips/tips.html");
  const tipHtml = fs.readFileSync(tipPath, {encoding: 'utf8'});
  
  const parts = tipHtml.split(/<article>([^]*?)<\/article>/m);
  return parts.filter( (p, i) => {
    return i % 2 === 1;
  });  
}

const tipData = loadTipFile();

class EtTipViewer extends ViewerElement implements config.AcceptsConfigManager, keybindingmanager.AcceptsKeyBindingManager {

  static TAG_NAME = "et-tip-viewer";
  
  static MIME_TYPE = "application/x-extraterm-tip";
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtTipViewer.TAG_NAME, {prototype: EtTipViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtTipViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTipViewer.
   */
  static is(node: Node): node is EtTipViewer {
    return node !== null && node !== undefined && node instanceof EtTipViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _configManager: ConfigManager;
  
  private _keyBindingManager: KeyBindingManager;
  
  private _height: number;
  
  private _tipIndex: number;
  
  private _initProperties(): void {
    this._log = new Logger(EtTipViewer.TAG_NAME);
    this._configManager = null;
    this._keyBindingManager = null;
    this._height = 0;
    this._tipIndex = 0;
  }

  //-----------------------------------------------------------------------
  //
  // ######                                
  // #     # #    # #####  #      #  ####  
  // #     # #    # #    # #      # #    # 
  // ######  #    # #####  #      # #      
  // #       #    # #    # #      # #      
  // #       #    # #    # #      # #    # 
  // #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------
  setConfigManager(newConfigManager: ConfigManager): void {
    if (this._configManager !== null) {
      this._configManager.unregisterChangeListener(this);
    }
    
    this._configManager = newConfigManager;
    if (this._configManager !== null) {
      this._configManager.registerChangeListener(this, this._configChanged.bind(this));
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
  
  get title(): string {
    return "Tip";
  }
  
  get awesomeIcon(): string {
    return "idea";
  }
  
  getSelectionText(): string {    
    return null;
  }

  focus(): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    domutils.focusWithoutScroll(containerDiv);
  }

  hasFocus(): boolean {
    const hasFocus = this === domutils.getShadowRoot(this).activeElement; // FIXME
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
    return [EtTipViewer.MIME_TYPE].indexOf(mimeType) !== -1;
  }
  
  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------
  
  createdCallback(): void {
    this._initProperties();
  }
  
  attachedCallback(): void {
    super.attachedCallback();
    
    this._tipIndex = this._configManager.getConfig().tipCounter % this._getTipCount();
    
    if (domutils.getShadowRoot(this) !== null) {
      return;
    }
    
    const shadow = domutils.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    
    // Intercept link clicks and open them in an external browser.
    containerDiv.addEventListener('click', (ev: MouseEvent) => {
      const source = <HTMLElement> ev.target;
      if (source.tagName === "A") {
        ev.preventDefault();
        shell.openExternal((<HTMLAnchorElement> source).href);
      }
    });
    
    this._setTipHTML(this._getTipHTML(this._tipIndex));
    
    const nextButton = domutils.getShadowId(this, ID_NEXT_BUTTON);
    nextButton.addEventListener('click', () => {
      this._tipIndex = (this._tipIndex + 1) % this._getTipCount();
      this._setTipHTML(this._getTipHTML(this._tipIndex));
    });
    
    const previousButton = domutils.getShadowId(this, ID_PREVIOUS_BUTTON);
    previousButton.addEventListener('click', () => {
      this._tipIndex = (this._tipIndex + this._getTipCount() - 1) % this._getTipCount();
      this._setTipHTML(this._getTipHTML(this._tipIndex));
    });
    
    const showTipsSelect = <HTMLSelectElement> domutils.getShadowId(this, ID_SHOW_TIPS);
    showTipsSelect.value = this._configManager.getConfig().showTips;
    showTipsSelect.addEventListener('change', () => {
      const newConfig = _.cloneDeep(this._configManager.getConfig());
      newConfig.showTips = <config.ShowTipsStrEnum> showTipsSelect.value;
      this._configManager.setConfig(newConfig);
    });
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    if (this._configManager !== null) {
      this._configManager.unregisterChangeListener(this);
    }
    super.detachedCallback();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TIP_VIEWER, ThemeTypes.CssFile.GUI_CONTROLS];
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                      
  // #     # #####  # #    #   ##   ##### ###### 
  // #     # #    # # #    #  #  #    #   #      
  // ######  #    # # #    # #    #   #   #####  
  // #       #####  # #    # ######   #   #      
  // #       #   #  #  #  #  #    #   #   #      
  // #       #    # #   ##   #    #   #   ###### 
  //
  //-----------------------------------------------------------------------
  /**
   * 
   */
  private createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}">
        </style>
        <div id="${ID_CONTAINER}" tabindex="-1" class="container-fluid">
          <div id="${ID_CONTENT}"></div>
          <hr />
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
    const showTipsSelect = <HTMLSelectElement> domutils.getShadowId(this, ID_SHOW_TIPS);
    showTipsSelect.value = this._configManager.getConfig().showTips;  
  }

  private _keyBindingChanged(): void {
    this._setTipHTML(this._getTipHTML(this._tipIndex));
  }

  private _setTipHTML(html: string): void {
    const contentDiv = domutils.getShadowId(this, ID_CONTENT);
    contentDiv.innerHTML = html;

    this._substituteKeycaps(contentDiv);
    this._fixImgRelativeUrls(contentDiv);
    
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    const rect = containerDiv.getBoundingClientRect();
    this._height = rect.height;
    this._adjustHeight(this._height);
    
    this._emitVirtualResizeEvent();
  }

  private _substituteKeycaps(contentDiv: HTMLElement): void {
    // Replace the kbd elements with the requested keyboard short cuts.
    const kbdElements = contentDiv.querySelectorAll("span."+CLASS_KEYCAP);
    domutils.toArray(kbdElements).forEach( (kbd) => {
      const dataContext = kbd.getAttribute("data-context");
      const dataCommand = kbd.getAttribute("data-command");
      if (dataContext !== null && dataCommand !== null) {
        const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(dataContext);
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
    const prefix = "file:///" + sourceDir.path + "/tips/";
    domutils.toArray(imgElements).forEach( (element) => {
      const img = <HTMLImageElement> element;
      img.src = prefix + img.getAttribute("src");
    });
  }

  private _getTipHTML(tipNumber: number): string {
    return tipData[tipNumber];
  }
  
  private _getTipCount(): number {
    return tipData.length;
  }
  
  private _emitVirtualResizeEvent(): void {
    if (DEBUG_SIZE) {
      this._log.debug("_emitVirtualResizeEvent");
    }
    const event = new CustomEvent(virtualscrollarea.EVENT_RESIZE, { bubbles: true });
    this.dispatchEvent(event);
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || domutils.getShadowRoot(this) === null) {
      return;
    }
    this.style.height = "" + newHeight + "px";
  }
}

export = EtTipViewer;
