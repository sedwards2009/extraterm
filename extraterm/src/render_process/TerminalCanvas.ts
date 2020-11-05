/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Logger, getLogger, log} from "extraterm-logging";
import { ResizeNotifier } from "extraterm-resize-notifier";
import { Disposable, Event } from '@extraterm/extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";

import * as DisposableUtils from '../utils/DisposableUtils';
import { ScrollBar } from "./gui/ScrollBar";
import { VirtualScrollAreaWithSpacing, Spacer } from "./VirtualScrollAreaWithSpacing";
import { EVENT_RESIZE, VirtualScrollable } from "./VirtualScrollArea";
import { ViewerElement } from "./viewers/ViewerElement";
import { TerminalViewer } from "./viewers/TerminalAceViewer";
import { AcceptsConfigDatabase, ConfigDatabase, GENERAL_CONFIG, GeneralConfig, ConfigChangeEvent } from "../Config";
import { doLater } from "extraterm-later";
import * as DomUtils from './DomUtils';
import { EmbeddedViewer } from "./viewers/EmbeddedViewer";
import { TextViewer } from "./viewers/TextAceViewer";
import { VisualState, Mode, CursorEdgeDetail, Edge, RefreshLevel } from "./viewers/ViewerElementTypes";
import { ResizeCanary } from "./ResizeCanary";
import { CustomElement } from "extraterm-web-component-decorators";
import { ThemeableElementBase } from "./ThemeableElementBase";
import { trimBetweenTags } from "extraterm-trim-between-tags";
import { CssFile } from '../theme/Theme';
import { EVENT_DRAG_STARTED, EVENT_DRAG_ENDED } from './GeneralEvents';
import { TerminalVisualConfig, injectTerminalVisualConfig } from "./TerminalVisualConfig";
import { disassembleDOMTree } from "./DomUtils";

const SCROLL_STEP = 1;
const CHILD_RESIZE_BATCH_SIZE = 3;

const MINIMUM_FONT_SIZE = -3;
const MAXIMUM_FONT_SIZE = 4;

interface ViewerElementStatus {
  element: ViewerElement;
  needsRefresh: boolean;
  refreshLevel: RefreshLevel;
}

const ID = "EtTerminalCanvasTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CSS_VARS = "ID_CSS_VARS";
const ID_SCROLL_AREA = "ID_SCROLL_AREA";
const ID_SCROLL_CONTAINER = "ID_SCROLL_CONTAINER";
const ID_SCROLLBAR_CONTAINER = "ID_SCROLLBAR_CONTAINER";
const ID_SCROLLBAR = "ID_SCROLLBAR";

@CustomElement("et-terminal-canvas")
export class TerminalCanvas extends ThemeableElementBase implements AcceptsConfigDatabase {

  static TAG_NAME = "et-terminal-canvas";
  private static _resizeNotifier = new ResizeNotifier();

  private _log: Logger;

  private _scrollContainer: HTMLDivElement;
  private _scrollArea: HTMLDivElement;
  private _scrollBar: ScrollBar;
  private _cssStyleElement: HTMLStyleElement;

  private _configDatabase: ConfigDatabase = null;
  private _configDatabaseDisposable: Disposable = null;
  private _baseTerminalVisualConfig: TerminalVisualConfig = null;
  private _effectiveTerminalVisualConfig: TerminalVisualConfig = null;
  private _virtualScrollArea: VirtualScrollAreaWithSpacing = null;
  private _stashArea: DocumentFragment = null;
  private _childElementList: ViewerElementStatus[] = [];
  private _needsCompleteRefresh = true;
  private _scheduleLaterHandle: Disposable = null;
  private _scheduleLaterQueue: Function[] = [];
  private _stashedChildResizeTask: () => void = null;

  // This flag is needed to prevent the _enforceScrollbackLength() method from being run recursively
  private _enforceScrollbackLengthGuard= false;
  private _childFocusHandlerFunc: (ev: FocusEvent) => void;
  private _lastChildWithFocus: ViewerElement = null;
  private _mode: Mode = Mode.DEFAULT;
  private _fontSizeAdjustment = 0;

  private _elementAttached = false;
  private _initialized = false;

  private _terminalViewer: TerminalViewer = null; // FIXME rename to 'focusTarget'?

  private _onBeforeSelectionChangeEmitter = new EventEmitter<{sourceMouse: boolean}>();
  onBeforeSelectionChange: Event<{sourceMouse: boolean}>;

  private _focusLaterDisposable: Disposable = null;
  private _terminalViewerFocusInProgress = false;

  constructor() {
    super();
    this._log = getLogger("TerminalCanvas", this);
    this._elementAttached = false;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this._elementAttached = true;
    if (this._initialized) {
      this.refresh(RefreshLevel.COMPLETE);
      this._updateScrollableSpacing();
      return;
    }

    this._initialized = true;
    this._setupShadowDOM();

    this._scrollContainer = <HTMLDivElement> DomUtils.getShadowId(this, ID_SCROLL_CONTAINER);
    this._scrollArea = <HTMLDivElement> DomUtils.getShadowId(this, ID_SCROLL_AREA);
    this._scrollBar = <ScrollBar> DomUtils.getShadowId(this, ID_SCROLLBAR);
    this._cssStyleElement = <HTMLStyleElement> DomUtils.getShadowId(this, ID_CSS_VARS);

    this.onBeforeSelectionChange = this._onBeforeSelectionChangeEmitter.event;
    this._childFocusHandlerFunc = this._handleChildFocus.bind(this);

    DomUtils.preventScroll(this._scrollContainer);

    TerminalCanvas._resizeNotifier.observe(this._scrollContainer, (target: Element, contentRect: DOMRectReadOnly) => {
      this._handleResize();
    });

    DomUtils.addCustomEventResender(this._scrollContainer, EVENT_DRAG_STARTED, this);
    DomUtils.addCustomEventResender(this._scrollContainer, EVENT_DRAG_ENDED, this);

    this._stashArea = window.document.createDocumentFragment();
    this._stashArea.addEventListener(EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));

    this._virtualScrollArea = new VirtualScrollAreaWithSpacing(0);
    this._virtualScrollArea.setScrollFunction( (offset: number): void => {
      this._scrollArea.style.top = "-" + offset + "px";
    });
    this._virtualScrollArea.setScrollbar(this._scrollBar);
    this._virtualScrollArea.setSetTopFunction((vsa, top) => this._setTopFunction(vsa, top));
    this._virtualScrollArea.setMarkVisibleFunction(
      (virtualScrollable: VirtualScrollable, visible:boolean) => this._markVisible(virtualScrollable, visible));

    this._scrollArea.addEventListener('mousedown', (ev: MouseEvent): void => {
      if (ev.target === this._scrollArea) {
        this._terminalViewer.focus();
        ev.preventDefault();
        ev.stopPropagation();
      }
    });

    this._scrollBar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(this._scrollBar.position);
    });

    this._scrollContainer.addEventListener('wheel', (ev: WheelEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();

      this._handleMouseWheelDelta(ev.deltaY);
    });

    this._scrollContainer.addEventListener("synthetic-wheel", (ev: CustomEvent): void => {
      this._handleMouseWheelDelta(ev.detail.deltaY);
    });

    this._scrollContainer.addEventListener("mousedown", (ev: MouseEvent): void => {
      if (ev.target === this._scrollContainer) {
        this.focus();
      }
    });

    this._scrollArea.addEventListener(EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    this._scrollArea.addEventListener(TerminalViewer.EVENT_KEYBOARD_ACTIVITY, () => {
      this._virtualScrollArea.scrollToBottom();
    });
    this._scrollArea.addEventListener(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE,
      this._handleBeforeSelectionChange.bind(this));
    this._scrollArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, this._handleViewerCursor.bind(this));
    this._scrollArea.addEventListener(ViewerElement.EVENT_CURSOR_EDGE, this._handleViewerCursorEdge.bind(this));

    this.updateThemeCss();
    this._setupFontResizeDetector();
    this._scheduleResize();
  }

  private _setupShadowDOM(): void {
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this._createShadowContents();
    shadow.appendChild(clone);
  }

  private _handleResize(): void {
    if ( ! this.isConnected) {
      return;
    }
    this.refresh(RefreshLevel.COMPLETE);
  }

  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      template.innerHTML = trimBetweenTags(`
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <style id="${ID_CSS_VARS}">${this._getCssVarsRules()}</style>
        <div id='${ID_CONTAINER}'>
          <div id='${ID_SCROLL_CONTAINER}'>
            <div id='${ID_SCROLL_AREA}'></div>
          </div>
          <div id='${ID_SCROLLBAR_CONTAINER}'>
            <et-scroll-bar id='${ID_SCROLLBAR}'></et-scroll-bar>
          </div>
        </div>`);
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  protected _themeCssFiles(): CssFile[] {
    return [CssFile.TERMINAL_CANVAS];
  }

  private _setupFontResizeDetector(): void {
    // A Resize Canary for tracking when terminal fonts are effectively changed in the DOM.
    const resizeCanary = <ResizeCanary> document.createElement(ResizeCanary.TAG_NAME);
    resizeCanary.setCss(`
        font-family: var(--terminal-font);
        font-size: var(--terminal-font-size);
    `);
    this._scrollContainer.appendChild(resizeCanary);
    resizeCanary.addEventListener('resize', () => {
      this.refresh(RefreshLevel.COMPLETE);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._needsCompleteRefresh = true;
    this._elementAttached = false;
  }

  addKeyboardEventListener(type: "keydown" | "keypress", listener: (this: Element, ev: KeyboardEvent) => any,
        capture=false): void {
    this._scrollContainer.addEventListener(type, listener, capture);
  }

  private _handleChildFocus(ev: FocusEvent): void {
    if (this._terminalViewerFocusInProgress) {
      // Prevent the doLater() work below from triggering even more work to do later.
      return;
    }

    if (ev.composedPath()[0] instanceof HTMLSelectElement) {
      // Don't steal the focus away from SELECT elements, otherwise they can't be used.
      return;
    }

    this._lastChildWithFocus = <ViewerElement> ev.currentTarget;

    // This needs to be done later otherwise it tickles a bug in
    // Chrome/Blink and prevents drag and drop from working.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=726248
    if (this._focusLaterDisposable != null) {
      this._focusLaterDisposable.dispose();
      this._focusLaterDisposable = null;
    }

    this._focusLaterDisposable = doLater( () => {
      this._focusLaterDisposable = null;
      if (this._mode === Mode.DEFAULT) {
        if (this._terminalViewer !== null) {
          if ( ! this._terminalViewer.hasFocus()) {
            this._terminalViewerFocusInProgress = true;
            DomUtils.focusWithoutScroll(this._terminalViewer);
            this._terminalViewerFocusInProgress = false;
          }
        }
      }
    });
  }

  private _handleBeforeSelectionChange(ev: CustomEvent): void {
    const target = ev.target;
    if (this._mode === Mode.DEFAULT && ! (<ViewerElement> target).hasSelection()) {
      return;
    }

    this._childElementList.forEach( (nodeInfo): void => {
      const node = nodeInfo.element;
      if (node !== target) {
        node.clearSelection();
      }
    });

    this._onBeforeSelectionChangeEmitter.fire({ sourceMouse: ev.detail.originMouse });
  }

  dispose(): void {
    this._disposeConfigDatabase();
    for (const kid of this._childElementList) {
      if (DisposableUtils.isDisposable(kid.element)) {
        kid.element.dispose();
      }
    }

    if (this._scrollContainer != null) {
      TerminalCanvas._resizeNotifier.unobserve(this._scrollContainer);
    }
  }

  setConfigDatabase(configManager: ConfigDatabase): void {
    this._disposeConfigDatabase();
    this._configDatabase = configManager;
    this._configDatabaseDisposable = this._configDatabase.onChange((event: ConfigChangeEvent) => {
      if (event.key === "general") {
        const oldConfig = <GeneralConfig> event.oldConfig;
        const newConfig = <GeneralConfig> event.newConfig;
        if (oldConfig.uiScalePercent !== newConfig.uiScalePercent ||
            oldConfig.terminalMarginStyle !== newConfig.terminalMarginStyle) {
          if (this._elementAttached) {
            this._updateScrollableSpacing();
            this.refresh(RefreshLevel.COMPLETE);
          }
        }
      }
    });
  }

  private _disposeConfigDatabase(): void {
    if (this._configDatabaseDisposable == null) {
      return;
    }
    this._configDatabaseDisposable.dispose();
    this._configDatabaseDisposable = null;
  }

  private _updateScrollableSpacing(): void {
    const generalConfig = this._configDatabase.getConfig("general");
    let spacing = 0;
    switch (generalConfig.terminalMarginStyle) {
      case "none":
        spacing = 0;
        break;
      case "thin":
        spacing = Math.round(this._rootFontSize()/2);
        break;
      case "normal":
        spacing = this._rootFontSize();
        break;
      case "thick":
        spacing = this._rootFontSize() * 2;
        break;
    }
    this._virtualScrollArea.setSpacing(spacing);
  }

  private _rootFontSize(): number {
    const generalConfig = this._configDatabase.getConfig("general");
    const unitHeightPx = 12;
    const rootFontSize = Math.max(Math.floor(unitHeightPx * generalConfig.uiScalePercent / 100), 5);
    return rootFontSize;
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this._baseTerminalVisualConfig = terminalVisualConfig;
    this._updateEffectiveTerminalVisualConfig();
  }

  private _updateEffectiveTerminalVisualConfig(): void {
    this._effectiveTerminalVisualConfig = this._computeEffectiveTerminalVisualConfig();
    this._applyTerminalVisualConfig();
  }

  private _applyTerminalVisualConfig(): void {
    for (const element of this.getViewerElements()) {
      injectTerminalVisualConfig(element, this._effectiveTerminalVisualConfig);
    }
  }

  private _computeEffectiveTerminalVisualConfig(): TerminalVisualConfig {
    const scaleFactor = this._effectiveFontScaleFactor(this._fontSizeAdjustment);
    const fontSizePx = this._baseTerminalVisualConfig.fontSizePx * scaleFactor;
    return {...this._baseTerminalVisualConfig, fontSizePx};
  }

  setModeAndVisualState(mode: Mode, visualState: VisualState): void {
    this._mode = mode;
    for (const element of this.getViewerElements()) {
      element.setMode(mode);
      element.setVisualState(visualState);
    }
  }

  setTerminalViewer(terminalViewer: TerminalViewer): void {
    this._terminalViewer = terminalViewer;
    this._markVisible(this._terminalViewer, true);
  }

  focus(): void {
    super.focus({preventScroll: true});
    if (this._mode === Mode.DEFAULT) {
      if (this._terminalViewer !== null) {
        DomUtils.focusWithoutScroll(this._terminalViewer);
      }
    } else {
      if (this._lastChildWithFocus != null) {
        this._lastChildWithFocus.focus();
      }
    }
  }

  hasFocus(): boolean {
    return DomUtils.getShadowRoot(this).activeElement !== null;
  }

  appendViewerElement(el: ViewerElement): void {
    el.addEventListener('focus', this._childFocusHandlerFunc);

    injectTerminalVisualConfig(el, this._effectiveTerminalVisualConfig);

    const visualState = this._mode === Mode.CURSOR ? VisualState.AUTO : VisualState.FOCUSED;
    el.setMode(this._mode);
    el.setVisualState(visualState);

    this._childElementList.push( { element: el, needsRefresh: false, refreshLevel: RefreshLevel.RESIZE } );
    this._scrollArea.appendChild(el);
    this._virtualScrollArea.appendScrollable(el);
  }

  removeViewerElement(el: ViewerElement): void {
    if (this._lastChildWithFocus === el) {
      this._lastChildWithFocus = null;
    }

    el.removeEventListener('focus', this._childFocusHandlerFunc);

    if (el.parentElement === this._scrollArea) {
      this._scrollArea.removeChild(el);
    } else if(el.parentNode === this._stashArea) {
      this._stashArea.removeChild(el);
    }

    const pos = this._childElementListIndexOf(el);
    this._childElementList.splice(pos, 1);

    this._virtualScrollArea.removeScrollable(el);

    if (this._terminalViewer === el) {
      this._terminalViewer = null;
    }
  }

  private _childElementListIndexOf(element: ViewerElement): number {
    const list = this._childElementList;;
    const len = list.length;
    for (let i=0; i<len; i++) {
      const item = list[i];
      if (item.element === element) {
        return i;
      }
    }
    return -1;
  }

  updateSize(element: ViewerElement): void {
    this._virtualScrollArea.updateScrollableSize(element);
  }

  private _handleMouseWheelDelta(deltaY: number): void {
    const delta = deltaY * SCROLL_STEP;
    this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset() + delta);
  }

  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    const el = <ViewerElement> ev.target;
    if (el.parentNode === this._stashArea) {
      this._scheduleStashedChildResize(el);
    } else {
      this._updateVirtualScrollableSize(el);
    }
  }

  private _markVisible(scrollable: VirtualScrollable, visible: boolean): void {
    if (scrollable instanceof Spacer) {
      return;
    }

    const scrollerArea = this._scrollArea;
    const element: ViewerElement = <any> scrollable;
    if ( ! visible) {

      if (this._terminalViewer !== element && ! element.hasFocus()) {
        // Move the scrollable into the stash area.
        this._stashArea.appendChild(element);
      }

    } else {

      if (element.parentElement !== scrollerArea) {
        // Move the element to the scroll area and place it in the correct position relative to the other child elements.

        const scrollerAreaChildrenCount = scrollerArea.children.length;
        if (scrollerAreaChildrenCount === 0) {
          scrollerArea.appendChild(element);
        } else {

          let scrollerIndex = 0;
          let childIndex = 0;
          while (childIndex < this._childElementList.length) {

            const currentElement = this._childElementList[childIndex].element;
            if (currentElement === element) {
              scrollerArea.insertBefore(element, scrollerArea.children[scrollerIndex]);
              break;
            }

            if (scrollerArea.children[scrollerIndex] === currentElement) {
              scrollerIndex++;
              if (scrollerIndex >= scrollerAreaChildrenCount) {
                scrollerArea.appendChild(element);
                break;
              }
            }
            childIndex++;
          }
        }

        // Set the current mode on the scrollable.
        const visualState = this._mode === Mode.CURSOR ? VisualState.AUTO : VisualState.FOCUSED;
        element.setMode(this._mode);
        element.setVisualState(visualState);
      }
    }
  }

  private _makeVisible(element: HTMLElement & VirtualScrollable): void {
    this._markVisible(element, true);
  }

  private _updateVirtualScrollableSize(virtualScrollable: VirtualScrollable): void {
    this._virtualScrollArea.updateScrollableSize(virtualScrollable);
    if (this._configDatabase != null) {
      const config = this._configDatabase.getConfig(GENERAL_CONFIG);
      this.enforceScrollbackSize(config.scrollbackMaxLines, config.scrollbackMaxFrames);
    }
  }

  refresh(requestedLevel: RefreshLevel): void {
    let level = requestedLevel;
    if (this._needsCompleteRefresh) {
      level = RefreshLevel.COMPLETE;
      this._needsCompleteRefresh = false;
    }

    const scrollerArea = this._scrollArea;
    if (scrollerArea !== null) {
      // Refresh the visible children
      for (const kid of scrollerArea.children) {
        if (kid instanceof ViewerElement) {
          kid.refresh(level);
        }
      }

      this._virtualScrollArea.updateContainerHeight(this._scrollContainer.clientHeight);

      // Build the list of elements we will resize right now.
      const childrenToResize: VirtualScrollable[] = [];
      for (const child of scrollerArea.children) {
        if (ViewerElement.isViewerElement(child)) {
          childrenToResize.push(child);
        }
      }

      // Keep track of which children will need a resize later on.
      const childrenToResizeSet = new Set(childrenToResize);
      for (const childStatus of this._childElementList) {
        if ( ! childrenToResizeSet.has(childStatus.element)) {
          childStatus.needsRefresh = true;
          childStatus.refreshLevel = level;
        }
      }

      if (childrenToResize.length !== this._childElementList.length) {
        this._scheduleStashedChildResizeTask();
      }

      this._virtualScrollArea.updateScrollableSizes(childrenToResize);
      this._virtualScrollArea.reapplyState();

      if (this._configDatabase != null) {
        const config = this._configDatabase.getConfig(GENERAL_CONFIG);
        this.enforceScrollbackSize(config.scrollbackMaxLines, config.scrollbackMaxFrames);
      }
    }
  }

  private _setTopFunction(scrollable: VirtualScrollable, top: number):  void {
    if (scrollable instanceof Spacer) {
      return;
    }
    (<HTMLElement> (<any> scrollable)).style.top = "" + top + "px";
  }

  private _handleViewerCursor(ev: CustomEvent): void {
    const node = <Node> ev.target;
    if (ViewerElement.isViewerElement(node)) {
      this._scrollViewerCursorIntoView(node);
    } else {
      this._log.warn("_handleTerminalViewerCursor(): node is not a ViewerElement.");
    }
  }

  private _scrollViewerCursorIntoView(viewer: ViewerElement): void {
    const pos = viewer.getCursorPosition();
    const nodeTop = this._virtualScrollArea.getScrollableTop(viewer);
    const top = pos.top + nodeTop;
    const bottom = pos.bottom + nodeTop;
    this._virtualScrollArea.scrollIntoView(top, bottom);
  }

  scheduleResize(): void {
    this._scheduleResize();
  }

  private _scheduleResize(): void {
    this._scheduleLaterProcessing( () => {
      this.refresh(RefreshLevel.RESIZE);
    });
  }

  private _scheduleStashedChildResize(el: HTMLElement & VirtualScrollable): void {
    if(el.parentNode !== this._stashArea) {
      return;
    }

    for (const childInfo of this._childElementList) {
      if (childInfo.element === el) {
        if ( ! childInfo.needsRefresh) {
          childInfo.needsRefresh = true;
          childInfo.refreshLevel = RefreshLevel.RESIZE;
          this._scheduleStashedChildResizeTask();
        }
        return;
      }
    }

    this._log.warn("_scheduleStashedChildResize() called with an unknown element instance.");
  }
  private _scheduleStashedChildResizeTask(): void {
    if (this._stashedChildResizeTask == null) {
      this._stashedChildResizeTask = () => {
        // Gather the list of elements/scrollables that need refreshing and updating.
        const processList: ViewerElementStatus[] = [];
        for (let i=this._childElementList.length-1; i>=0 && processList.length < CHILD_RESIZE_BATCH_SIZE; i--) {
          const childStatus = this._childElementList[i];
          if (childStatus.needsRefresh) {
            processList.push(childStatus);
            childStatus.needsRefresh = false;
          }
        }

        if (processList.length !== 0) {
          // Find the elements which need to be moved into the scroll area.
          const stashedList: (HTMLElement & VirtualScrollable)[] = [];
          for (const childStatus of processList) {
            const element = childStatus.element;
            if (element.parentElement !== this._scrollArea) {
              stashedList.push(element);
            }
          }

          stashedList.forEach(el => this._markVisible(el, true));

          for (const childStatus of processList) {
            const el = childStatus.element;
            if (el instanceof ViewerElement) {
              el.refresh(childStatus.refreshLevel);
            }
          }

          this._virtualScrollArea.updateScrollableSizes(processList.map(childStatus => childStatus.element));

          if (stashedList.length !== 0) {
            stashedList.filter( (el) => ! this._virtualScrollArea.getScrollableVisible(el))
              .forEach( (el) => this._markVisible(el, false) );
          }

          this._scheduleStashedChildResizeTask();
        }
      };
    }

    if (this._scheduleLaterQueue.indexOf(this._stashedChildResizeTask) === -1) {
      this._scheduleLaterProcessing(this._stashedChildResizeTask);
    }
  }

  private _scheduleLaterProcessing(func: Function): void {
    this._scheduleLaterQueue.push(func);

    if (this._scheduleLaterHandle === null) {
      this._scheduleLaterHandle = doLater( () => {
        this._scheduleLaterHandle = null;
        const queue = this._scheduleLaterQueue;
        this._scheduleLaterQueue = [];
        queue.forEach( (func) => func() );
      });
    }
  }

  getFontSizeAdjustment(): number {
    return this._fontSizeAdjustment;
  }

  setFontSizeAdjustment(delta: number): void {
    this._adjustFontSize(delta);
  }

  private _adjustFontSize(delta: number): void {
    const newAdjustment = Math.min(Math.max(this._fontSizeAdjustment + delta, MINIMUM_FONT_SIZE), MAXIMUM_FONT_SIZE);
    if (newAdjustment !== this._fontSizeAdjustment) {
      this._fontSizeAdjustment = newAdjustment;
      this._setFontSizeInCss(newAdjustment);
      this._updateEffectiveTerminalVisualConfig();
    }
  }

  private _setFontSizeInCss(size: number): void {
    (<any>this._cssStyleElement.sheet).cssRules[0].style.cssText = this._getCssFontSizeRule(size);
    // The type stubs don't have cssRules defined.
  }

  private _resetFontSize(): void {
    this._adjustFontSize(-this._fontSizeAdjustment);
  }

  resetFontSize(): void {
    this._resetFontSize();
  }

  private _getCssVarsRules(): string {
    return `
    #${ID_CONTAINER} {
        ${this._getCssFontSizeRule(this._fontSizeAdjustment)}
    }
    `;
  }

  private _getCssFontSizeRule(adjustment: number): string {
    const scale = this._effectiveFontScaleFactor(adjustment);
    return `--terminal-font-size: calc(var(--default-terminal-font-size) * ${scale});`;
  }

  private _effectiveFontScaleFactor(adjustment: number): number {
    return [0.6, 0.75, 0.89, 1, 1.2, 1.5, 2, 3][adjustment-MINIMUM_FONT_SIZE];
  }

  private _handleViewerCursorEdge(ev: CustomEvent): void {
    const detail = <CursorEdgeDetail> ev.detail;
    const index = this._childElementListIndexOf(<any> ev.target);
    if (index === -1) {
      this._log.warn("_handleTerminalViewerCursorEdge(): Couldn't find the target.");
      return;
    }

    if (detail.edge === Edge.TOP) {
      // A top edge was hit. Move the cursor to the bottom of the ViewerElement above it.
      for (let i=index-1; i>=0; i--) {
        const node = this._childElementList[i].element;
        this._makeVisible(node);
        if (node.setCursorPositionBottom(detail.ch)) {
          DomUtils.focusWithoutScroll(node);
          this._scrollViewerCursorIntoView(node);
          break;
        }
      }

    } else {
      // Bottom edge. Move the cursor to the top of the next ViewerElement.
      for (let i=index+1; i<this._childElementList.length; i++) {
        const node = this._childElementList[i].element;
        this._makeVisible(node);
        if (node.setCursorPositionTop(detail.ch)) {
          DomUtils.focusWithoutScroll(node);
          this._scrollViewerCursorIntoView(node);
          break;
        }
      }
    }
  }

  // Run a function and only afterwards check the size of the scrollback.
  enforceScrollbackLengthAfter(func: () => any): any {
    const oldGuardFlag = this._enforceScrollbackLengthGuard;
    this._enforceScrollbackLengthGuard = true;
    const rc = func();
    this._enforceScrollbackLengthGuard = oldGuardFlag;

    if (this._configDatabase != null) {
      const config = this._configDatabase.getConfig(GENERAL_CONFIG);
      this.enforceScrollbackSize(config.scrollbackMaxLines, config.scrollbackMaxFrames);
    }
    return rc;
  }

  enforceScrollbackSize(maxScrollbackLines: number, maxScrollbackFrames: number): void {
    // Prevent the scrollback check from running multiple times.
    if (this._enforceScrollbackLengthGuard) {
      return;
    }
    this._enforceScrollbackLengthGuard = true;
    this._enforceScrollbackSize2(maxScrollbackLines, maxScrollbackFrames);
    this._enforceScrollbackLengthGuard = false;
  }

  private _enforceScrollbackSize2(maxScrollbackLines: number, maxScrollbackFrames: number): void {
    const windowHeight = window.screen.height;
    const killList: ViewerElement[] = [];

    const childrenReverse = Array.from(this._childElementList);
    childrenReverse.reverse();

    // Skip past everything which could fit on one screen.
    let i = 0;
    let currentHeight = 0;
    while (i < childrenReverse.length) {
      const scrollableKid = childrenReverse[i].element;
      const kidVirtualHeight = this._virtualScrollArea.getScrollableVirtualHeight(scrollableKid);
      if (currentHeight + kidVirtualHeight > windowHeight) {
        break;
      }
      currentHeight += kidVirtualHeight;
      i++;
    }

    let linesInScrollback = 0;

    // We may have found the element which straddles the visible top of the screen.
    if (i < childrenReverse.length) {
      const scrollableKid = childrenReverse[i].element;
      i++;

      const textLikeViewer = this._castToTextLikeViewer(scrollableKid);
      if (textLikeViewer != null) {
        const visibleRows = textLikeViewer.pixelHeightToRows(windowHeight - currentHeight);
        linesInScrollback = textLikeViewer.lineCount() - visibleRows;
        if (linesInScrollback > maxScrollbackLines) {

          if (TerminalViewer.is(scrollableKid)) {
            // Trim it.
            textLikeViewer.deleteTopLines(linesInScrollback - maxScrollbackLines);
          } else {
            // Delete it outright.
            killList.push(scrollableKid);
          }

          while (i < childrenReverse.length) {
            killList.push(childrenReverse[i].element);
            i++;
          }
          i = childrenReverse.length;
        }
      }
    }

    let frameCount = 0;
    while (i < childrenReverse.length) {
      const scrollableKid = childrenReverse[i].element;
      i++;
      frameCount++;

      const textLikeViewer = this._castToTextLikeViewer(scrollableKid);
      if (textLikeViewer != null) {
        linesInScrollback += textLikeViewer.lineCount();
        if (frameCount > maxScrollbackFrames || linesInScrollback > maxScrollbackLines) {

          // We've hit a limit. Delete the rest.
          killList.push(scrollableKid);
          while (i < childrenReverse.length) {
            killList.push(childrenReverse[i].element);
            i++;
          }
          i = childrenReverse.length;
        }

        linesInScrollback += textLikeViewer.lineCount();
      }
    }

    for (const scrollableKid of killList) {
      this.removeViewerElement(scrollableKid);
    }
  }

  private _castToTextLikeViewer(kidNode: ViewerElement): {
      deleteTopLines(lines: number): void;
      lineCount(): number;
      pixelHeightToRows(pixelHeight: number): number; } {

    if (TerminalViewer.is(kidNode)) {
      return kidNode;
    } else if (EmbeddedViewer.is(kidNode)) {
      const viewer = kidNode.getViewerElement();
      if (TerminalViewer.is(viewer)) {
        return viewer;
      } else if (TextViewer.is(viewer)) {
        return viewer;
      }
    }
    return null;
  }

  goToPreviousFrame(): void {
    const heights = this._virtualScrollArea.getScrollableHeightsIncSpacing();

    const y = this._virtualScrollArea.getScrollYOffset();
    let heightCount = 0;
    for (const heightInfo of heights) {
      if (y <= (heightCount + heightInfo.height)) {
        this._virtualScrollArea.scrollTo(heightCount);
        break;
      }
      heightCount += heightInfo.height;
    }
  }

  goToNextFrame(): void {
    const heights = this._virtualScrollArea.getScrollableHeightsIncSpacing();

    const y = this._virtualScrollArea.getScrollYOffset();
    let heightCount = 0;
    for (const heightInfo of heights) {
      if (y < (heightCount + heightInfo.height)) {
        this._virtualScrollArea.scrollTo(heightCount + heightInfo.height);
        break;
      }
      heightCount += heightInfo.height;
    }
  }

  scrollPageUp(): void {
    this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
      - this._virtualScrollArea.getScrollContainerHeight() / 2);
  }

  scrollPageDown(): void {
    this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
      + this._virtualScrollArea.getScrollContainerHeight() / 2);
  }

  getLastEmbeddedViewer(): EmbeddedViewer {
    const kids = this._childElementList;
    const len = this._childElementList.length;
    for (let i=len-1; i>=0;i--) {
      const kid = kids[i].element;
      if (EmbeddedViewer.is(kid)) {
        return kid;
      }
    }
    return null;
  }

  getViewerElements(): ViewerElement[] {
    return this._childElementList.map(x => x.element);
  }

  getSelectionText(): string {
    let text: string = null;
    for (const viewerInfo of this._childElementList) {
      text = viewerInfo.element.getSelectionText();
      if (text !== null) {
        return text;
      }
    }
    return null;
  }
}
