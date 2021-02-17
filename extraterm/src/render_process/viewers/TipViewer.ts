/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import * as Electron from 'electron';
const shell = Electron.shell;
import * as fs from 'fs';
import * as path from 'path';
import * as he from 'he';
import * as SourceDir from '../../SourceDir';
import { CustomElement } from 'extraterm-web-component-decorators';
import {ViewerMetadata, Disposable} from '@extraterm/extraterm-extension-api';
import {Logger, getLogger} from "extraterm-logging";
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ResizeNotifier } from 'extraterm-resize-notifier';
import { AcceptsConfigDatabase, ConfigDatabase, GENERAL_CONFIG, ShowTipsStrEnum } from '../../Config';
import { KeybindingsManager, AcceptsKeybindingsManager } from '../keybindings/KeyBindingsManager';
import {ViewerElement} from '../viewers/ViewerElement';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';
import { emitResizeEvent, SetterState } from '../VirtualScrollArea';

const ID = "EtTipViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CONTENT = "ID_CONTENT";
const ID_CONTROLS = "ID_CONTROLS";
const ID_PREVIOUS_BUTTON = "ID_PREVIOUS_BUTTON";
const ID_NEXT_BUTTON = "ID_NEXT_BUTTON";
const ID_SHOW_TIPS = "ID_SHOW_TIPS";
const CLASS_KEYCAP = "CLASS_KEYCAP";


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

@CustomElement("et-tip-viewer")
export class TipViewer extends ViewerElement implements AcceptsConfigDatabase, AcceptsKeybindingsManager, Disposable {

  static TAG_NAME = "ET-TIP-VIEWER";
  static MIME_TYPE = "application/x-extraterm-tip";
  private static _resizeNotifier = new ResizeNotifier();

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
  private _configManager: ConfigDatabase = null;
  private _keybindingsManager: KeybindingsManager = null;
  private _height = 0;
  private _tipIndex = 0;
  private _configManagerDisposable: Disposable = null;
  private _keybindingsManagerDisposable: Disposable = null;

  constructor() {
    super();
    this._log = getLogger(TipViewer.TAG_NAME, this);
  }

  dispose(): void {
    if (this._configManagerDisposable != null) {
      this._configManagerDisposable.dispose();
      this._configManagerDisposable = null;
    }

    if (this._keybindingsManagerDisposable != null) {
      this._keybindingsManagerDisposable.dispose();
      this._keybindingsManagerDisposable = null;
    }

    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    if (containerDiv != null) {
      TipViewer._resizeNotifier.unobserve(containerDiv);
    }

    super.dispose();
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Tip";
    metadata.icon = "far fa-lightbulb";
    return metadata;
  }

  connectedCallback(): void {
    super.connectedCallback();

    if (DomUtils.getShadowRoot(this) == null) {
      this._tipIndex = this._configManager.getConfig(GENERAL_CONFIG).tipCounter % this._getTipCount();
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
      const clone = this.createClone();
      shadow.appendChild(clone);
      this.updateThemeCss();

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      TipViewer._resizeNotifier.observe(containerDiv, (target: Element, contentRect: DOMRectReadOnly) => {
        this._handleResize();
      });

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
      showTipsSelect.value = this._configManager.getConfig(GENERAL_CONFIG).showTips;
      showTipsSelect.addEventListener('change', () => {
        const newConfig = this._configManager.getConfigCopy(GENERAL_CONFIG);
        newConfig.showTips = <ShowTipsStrEnum> showTipsSelect.value;
        this._configManager.setConfig(GENERAL_CONFIG, newConfig);
      });
    }
    this._handleResize();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TIP_VIEWER, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GENERAL_GUI];
  }

  private _handleResize(): void {
    if ( ! this.isConnected) {
      return;
    }

    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    const rect = containerDiv.getBoundingClientRect();
    if (rect.height === this._height) {
      return;
    }
    this._height = rect.height;
    emitResizeEvent(this);
  }

  setConfigDatabase(newConfigManager: ConfigDatabase): void {
    if (this._configManagerDisposable !== null) {
      this._configManagerDisposable.dispose();
      this._configManagerDisposable = null;
    }

    this._configManager = newConfigManager;
    if (this._configManager !== null) {
      this._configManagerDisposable = this._configManager.onChange(this._configChanged.bind(this));
    }
  }

  setKeybindingsManager(newKeybindingsManager: KeybindingsManager): void {
    if (this._keybindingsManagerDisposable !== null) {
      this._keybindingsManagerDisposable.dispose();
      this._keybindingsManagerDisposable = null;
    }

    this._keybindingsManager = newKeybindingsManager;
    if (this._keybindingsManager !== null) {
      this._keybindingsManagerDisposable = this._keybindingsManager.onChange(this._keyBindingChanged.bind(this));
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
    DomUtils.focusElement(containerDiv, this._log, true);
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
  }

  // VirtualScrollable
  getMinHeight(): number {
    return this._height;
  }

   // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    return this._height;
  }

  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    return 0;
  }

  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return [TipViewer.MIME_TYPE].indexOf(mimeType) !== -1;
  }

  private createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = trimBetweenTags(`<style id="${ThemeableElementBase.ID_THEME}">
        </style>
        <div id="${ID_CONTAINER}">
          <div id="${ID_CONTENT}"></div>
          <div id="${ID_CONTROLS}">
            <div class="group">
              <button id="${ID_PREVIOUS_BUTTON}" title="Previous Tip" class="small"><i class="fa fa-chevron-left" aria-hidden="true"></i></button>
              <button id="${ID_NEXT_BUTTON}" title="Next Tip" class="small"><i class="fa fa-chevron-right" aria-hidden="true"></i></button>
            </div>
            <div class="form-group">
              <label for="">Show tips: </label>
              <select id="${ID_SHOW_TIPS}">
                <option value="always">Everytime</option>
                <option value="daily">Daily</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
        </div>`);

      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _configChanged(): void {
    const showTipsSelect = <HTMLSelectElement> DomUtils.getShadowId(this, ID_SHOW_TIPS);
    showTipsSelect.value = this._configManager.getConfig(GENERAL_CONFIG).showTips;
  }

  private _keyBindingChanged(): void {
    this._setTipHTML(this._getTipHTML(this._tipIndex));
  }

  private _setTipHTML(html: string): void {
    const contentDiv = DomUtils.getShadowId(this, ID_CONTENT);
    contentDiv.innerHTML = html;

    this._substituteKeycaps(contentDiv);
    this._fixImgRelativeUrls(contentDiv);
  }

  private _substituteKeycaps(contentDiv: HTMLElement): void {
    // Replace the kbd elements with the requested keyboard short cuts.
    const kbdElements = contentDiv.querySelectorAll("span."+CLASS_KEYCAP);
    DomUtils.toArray(kbdElements).forEach( (kbd) => {
      const dataCommand = kbd.getAttribute("data-command");
      if (dataCommand !== null) {
        const keyBindings = this._keybindingsManager.getKeybindingsMapping();
        if (keyBindings != null) {
          const shortcut = keyBindings.mapCommandToReadableKeyStrokes(dataCommand);
          if (shortcut.length !== 0) {
            kbd.innerHTML = `<span class="keycap">${he.encode(shortcut[0])}</span>`;
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

  private _getTipHTML(tipNumber: number): string {
    return tipData[tipNumber];
  }

  private _getTipCount(): number {
    return tipData.length;
  }
}
