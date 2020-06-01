/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Disposable } from '@extraterm/extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';

import {doLater} from 'extraterm-later';
import * as DomUtils from './DomUtils';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import {ResizeCanary} from './ResizeCanary';
import {ScrollBar} from'./gui/ScrollBar';
import * as ThemeTypes from '../theme/Theme';
import {ThemeableElementBase} from './ThemeableElementBase';
import {ViewerElement} from "./viewers/ViewerElement";
import { VirtualScrollable, VirtualScrollArea, EVENT_RESIZE } from './VirtualScrollArea';
import { RefreshLevel } from './viewers/ViewerElementTypes';

type ScrollableElement = VirtualScrollable & HTMLElement;

const ID = "EtVirtualScrollCanvasTemplate";

const ID_SCROLL_AREA = "ID_SCROLL_AREA";
const ID_SCROLLBAR = "ID_SCROLLBAR";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CSS_VARS = "ID_CSS_VARS";

const MINIMUM_FONT_SIZE = -3;
const MAXIMUM_FONT_SIZE = 4;

const SCROLL_STEP = 1;


const intersectionObserver = new IntersectionObserver((entries) => {
  for (const item of entries) {
    if (item.intersectionRatio > 0) {
      (<VirtualScrollCanvas> item.target)._elementIsVisibleEvent();
    }
  }
});


/**
 * A surface for displaying virtual scrollable elements including scrollbars.
 */
@WebComponent({tag: "et-virtual-scroll-canvas"})
export class VirtualScrollCanvas extends ThemeableElementBase {

  static TAG_NAME = "ET-VIRTUAL-SCROLL-CANVAS";

  private _log: Logger;
  private _virtualScrollArea: VirtualScrollArea = null;

  private _resizePollHandle: Disposable = null;
  private _needsCompleteRefresh = true;
  private _fontSizeAdjustment = 0;
  private _armResizeCanary = false;  // Controls when the resize canary is allowed to chirp.
  private _dialogStack: HTMLElement[] = [];

  constructor() {
    super();
    this._log = getLogger(VirtualScrollCanvas.TAG_NAME, this);

    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });

    const clone = this._createClone();
    shadow.appendChild(clone);
    this._virtualScrollArea = new VirtualScrollArea();

    const scrollbar = <ScrollBar> DomUtils.getShadowId(this, ID_SCROLLBAR);
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);

    const scrollContainer = DomUtils.getShadowId(this, ID_CONTAINER);
    DomUtils.preventScroll(scrollContainer);

    this._virtualScrollArea.setScrollFunction( (offset: number): void => {
      scrollerArea.scrollTop = offset;
    });
    this._virtualScrollArea.setScrollbar(scrollbar);

    scrollerArea.addEventListener('wheel', (ev) => this._handleMouseWheel(ev), true);
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(scrollbar.position);
    });

    scrollerArea.addEventListener(EVENT_RESIZE,
      (ev: CustomEvent) => this._handleVirtualScrollableResize(ev));
    scrollerArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE,
      (ev: CustomEvent) => this._handleTerminalViewerCursor(ev));

        // A Resize Canary for tracking when terminal fonts are effectively changed in the DOM.
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    const resizeCanary = <ResizeCanary> document.createElement(ResizeCanary.TAG_NAME);
    resizeCanary.setCss(`
        font-family: var(--terminal-font);
        font-size: var(--terminal-font-size);
    `);
    containerDiv.appendChild(resizeCanary);
    resizeCanary.addEventListener('resize', () => {
      if (this._armResizeCanary) {
        this._armResizeCanary = false;
        this.refresh(RefreshLevel.COMPLETE);
      }
    });

    this.updateThemeCss();
  }

  connectedCallback(): void {
    super.connectedCallback();
    intersectionObserver.observe(this);
    doLater(() => this.refresh(RefreshLevel.COMPLETE));
  }

  disconnectedCallback(): void {
    intersectionObserver.unobserve(this);
    super.disconnectedCallback();
    this._needsCompleteRefresh = true;
  }

  dispose(): void {
    const element = this.getViewerElement();
    if (element !== null) {
      element.dispose();
    }
    if (this._resizePollHandle !== null) {
      this._resizePollHandle.dispose();
      this._resizePollHandle = null;
    }
  }

  focus(): void {
    if (this._dialogStack.length !== 0) {
      this._dialogStack[this._dialogStack.length-1].focus();
      return;
    }

    const element = this.getViewerElement();
    if (element !== null) {
      element.focus();
    }
  }

  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    const shadowRoot = DomUtils.getShadowRoot(this);
    if (shadowRoot === null) {
      return false;
    }
    return shadowRoot.activeElement !== null;
  }

  setViewerElement(element: ViewerElement): void {
    if (this.childNodes.length !== 0) {
      this.innerHTML = "";
    }

    if (element !== null) {
      this._appendScrollableElement(element);
    }
  }

  getViewerElement(): ViewerElement {
    return this._getViewerElement();
  }

  getFontAdjust(): number {
    return this._fontSizeAdjustment;
  }

  setFontAdjust(delta: number): void {
    this._adjustFontSize(delta);
  }

  scrollContentsTo(offset: number): void {
    this._virtualScrollArea.scrollTo(offset);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.VIRTUAL_SCROLL_CANVAS];
  }

  _elementIsVisibleEvent(): void {
    this.refresh(RefreshLevel.COMPLETE);
    intersectionObserver.unobserve(this);
  }

  refresh(requestedLevel: RefreshLevel): void {
    let level = requestedLevel;
    if (this._needsCompleteRefresh) {
      level = RefreshLevel.COMPLETE;
      this._needsCompleteRefresh = false;
    }

    const viewerElement = this._getViewerElement();
    if (viewerElement != null) {
      const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
      for (const kid of scrollerArea.children) {
        if (kid instanceof ViewerElement) {
          kid.refresh(level);
        }
      }

      const scrollContainer = DomUtils.getShadowId(this, ID_CONTAINER);
      this._virtualScrollArea.updateContainerHeight(scrollContainer.getBoundingClientRect().height);

      viewerElement.refresh(level);

      this._virtualScrollArea.updateScrollableSizes([viewerElement]);
      this._virtualScrollArea.reapplyState();
    }
  }

  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      template.innerHTML = `
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <style id="${ID_CSS_VARS}">${this._getCssVarsRules()}</style>
        <div id='${ID_CONTAINER}'>
          <div id='${ID_SCROLL_AREA}'></div>
          <et-scroll-bar id='${ID_SCROLLBAR}'></et-scroll-bar>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _getCssVarsRules(): string {
    return `
    #${ID_CONTAINER} {
        ${this._getCssFontSizeRule(this._fontSizeAdjustment)}
    }
    `;
  }

  private _getCssFontSizeRule(adjustment: number): string {
    const scale = [0.6, 0.75, 0.89, 1, 1.2, 1.5, 2, 3][adjustment-MINIMUM_FONT_SIZE];
    return `--terminal-font-size: calc(var(--default-terminal-font-size) * ${scale});`;
  }

  private _getViewerElement(): ViewerElement {
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    if (scrollerArea.firstElementChild !== null && scrollerArea.firstElementChild instanceof ViewerElement) {
      return <ViewerElement> scrollerArea.firstElementChild;
    } else {
      return null;
    }
  }

  private _appendScrollableElement(el: ScrollableElement): void {
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.appendChild(el);
    this._virtualScrollArea.appendScrollable(el);
  }

  private _handleMouseWheel(ev: WheelEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    const delta = ev.deltaY * SCROLL_STEP;
    this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset() + delta);
  }

  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    this._updateVirtualScrollableSize(<any> ev.target);
      // ^ We know this event only comes from VirtualScrollable elements.
  }

  private _updateVirtualScrollableSize(virtualScrollable: VirtualScrollable): void {
    this._virtualScrollArea.updateScrollableSize(virtualScrollable);
  }

  private _handleTerminalViewerCursor(ev: CustomEvent): void {
    const node = <Node> ev.target;
    if (ViewerElement.isViewerElement(node)) {
      const pos = node.getCursorPosition();
      const nodeTop = this._virtualScrollArea.getScrollableTop(node);
      const top = pos.top + nodeTop;
      const bottom = pos.bottom;
      this._virtualScrollArea.scrollIntoView(top, bottom);
    }
  }

  private _adjustFontSize(delta: number): void {
    const newAdjustment = Math.min(Math.max(this._fontSizeAdjustment + delta, MINIMUM_FONT_SIZE), MAXIMUM_FONT_SIZE);
    if (newAdjustment !== this._fontSizeAdjustment) {
      this._fontSizeAdjustment = newAdjustment;

      const styleElement = <HTMLStyleElement> DomUtils.getShadowId(this, ID_CSS_VARS);
      if (styleElement != null) {
        (<any>styleElement.sheet).cssRules[0].style.cssText = this._getCssFontSizeRule(newAdjustment);  // Type stubs are missing cssRules.
        this._armResizeCanary = true;
        // Don't refresh. Let the Resize Canary detect the real change in the DOM when it arrives.
      }
    }
  }
}
