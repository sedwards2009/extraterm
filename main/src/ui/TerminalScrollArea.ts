/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Direction,
  FocusPolicy,
  Margins,
  QBoxLayout,
  QSize,
  QSizePolicyPolicy,
  QWheelEvent,
  QWidget,
  WidgetEventTypes,
} from "@nodegui/nodegui";
import { BoxLayout, Widget, WidgetOptions } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { EventEmitter } from "extraterm-event-emitter";
import { Event } from "@extraterm/extraterm-extension-api";
import { BlockFrame } from "../terminal/BlockFrame";


const SCROLL_SCALE = 0.5;

export class TerminalScrollArea {

  private _log: Logger;
  #topWidget: QWidget;
  #viewportWidget: QWidget;
  #contentWidget: QWidget;
  #blockFrames: BlockFrame[] = [];
  #boxLayout: QBoxLayout = null;
  #scrollPosition = 0;

  #marginLeft = 0;
  #marginTop = 0;
  #marginRight = 0;
  #marginBottom = 0;

  #bottomLocked = true;

  #onScrollPositionChangedEventEmitter = new EventEmitter<number>();
  onScrollPositionChanged: Event<number> = null;
  #lastReportedScrollPosition = -1;

  #onScrollRangeChangedEventEmitter = new EventEmitter<number>();
  onScrollRangeChanged: Event<number> = null;
  #lastReportedScrollRange = -1;

  #onScrollPageSizeChangedEventEmitter = new EventEmitter<number>();
  onScrollPageSizeChanged: Event<number> = null;
  #lastReportedPageSize = -1;

  constructor(options: WidgetOptions) {
    this._log = getLogger("TerminalScrollArea", this);
    this.onScrollPositionChanged = this.#onScrollPositionChangedEventEmitter.event;
    this.onScrollRangeChanged = this.#onScrollRangeChangedEventEmitter.event;
    this.onScrollPageSizeChanged = this.#onScrollPageSizeChangedEventEmitter.event;

    this.#topWidget = Widget({
      contentsMargins: 0,
      cssClass: ["background"],
      focusPolicy: FocusPolicy.ClickFocus,
      layout: BoxLayout({
        contentsMargins: 0,
        spacing: 0,
        direction: Direction.LeftToRight,
        children: [
          this.#viewportWidget = Widget({
            focusPolicy: FocusPolicy.ClickFocus,
            sizePolicy: {
              vertical: QSizePolicyPolicy.MinimumExpanding,
              horizontal: QSizePolicyPolicy.MinimumExpanding,
            },
            onResize: (native) => {
              this.#layout();
            },
            onWheel: (native) => {
              this.#handleWheel(new QWheelEvent(native));
            },
            onFocusIn: () => {
              this.#contentWidget.setFocus();
            }
          })
        ]
      })
    });

    this.#contentWidget = Widget({
      ...options,
      focusPolicy: FocusPolicy.ClickFocus,
      layout: this.#boxLayout = BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: 0,
        children: []
      })
    });
    this.#contentWidget.setParent(this.#viewportWidget);

    this.#contentWidget.addEventListener(WidgetEventTypes.LayoutRequest, () => {
      this.#layout();
    }, {afterDefault: true});
  }

  getScrollPosition(): number {
    return this.#scrollPosition;
  }

  getMaximumScrollPosition(): number {
    const viewportGeo = this.#viewportWidget.contentsRect();
    const contentGeo = this.#contentWidget.contentsRect();
    return Math.max(0, contentGeo.height() - viewportGeo.height());
  }

  setScrollPosition(position: number): void {
    const maxScroll = this.getMaximumScrollPosition();
    this.#scrollPosition = Math.max(0, Math.min(position, maxScroll));
    this.#bottomLocked = this.#scrollPosition + 8 > maxScroll;
    this.#layout();
  }

  getWidget(): QWidget {
    return this.#topWidget;
  }

  getContentWidget(): QWidget {
    return this.#contentWidget;
  }

  scrollToMaximum(): void {
    this.#bottomLocked = true;
    this.#layout();
  }

  scrollPageDown(): void {
    const viewportGeo = this.#viewportWidget.contentsRect();
    this.setScrollPosition(this.#scrollPosition + viewportGeo.height());
  }

  scrollPageUp(): void {
    const viewportGeo = this.#viewportWidget.contentsRect();
    this.#bottomLocked = false;
    this.setScrollPosition(this.#scrollPosition - viewportGeo.height());
  }

  getMaximumViewportSize(): QSize {
    const geo = this.#viewportWidget.contentsRect();
    return new QSize(geo.width(), geo.height());
  }

  setViewportMargins(left: number, top: number, right: number, bottom: number): void {
    this.#marginLeft = left;
    this.#marginTop = top;
    this.#marginRight = right;
    this.#marginBottom = bottom;
    this.#topWidget.setContentsMargins(left, top, right, bottom);
  }

  getViewportMargins(): Margins {
    return {
      left: this.#marginLeft,
      top: this.#marginTop,
      right: this.#marginRight,
      bottom: this.#marginBottom,
    };
  }

  #layout(): void {
    const viewportGeo = this.#viewportWidget.contentsRect();
    const width = viewportGeo.width();
    const scrollPageSize = viewportGeo.height();
    const hint = this.#contentWidget.sizeHint();
    const contentWidgetHeight = hint.height();
    if (this.#bottomLocked) {
      this.#scrollPosition = Math.max(0, contentWidgetHeight - scrollPageSize);
    }
    this.#contentWidget.setGeometry(0, -this.#scrollPosition, width, contentWidgetHeight);

    this.#updateViewportTopOnFrames();

    const maxPos = this.getMaximumScrollPosition();
    if (maxPos !== this.#lastReportedScrollRange) {
      this.#lastReportedScrollRange = maxPos;
      this.#onScrollRangeChangedEventEmitter.fire(maxPos);
    }
    if (this.#lastReportedPageSize !== scrollPageSize) {
      this.#lastReportedPageSize = scrollPageSize;
      this.#onScrollPageSizeChangedEventEmitter.fire(this.#lastReportedPageSize);
    }
    if (this.#scrollPosition !== this.#lastReportedScrollPosition) {
      this.#lastReportedScrollPosition = this.#scrollPosition;
      this.#onScrollPositionChangedEventEmitter.fire(this.#scrollPosition);
    }
  }

  appendBlockFrame(blockFrame: BlockFrame): void {
    this.#boxLayout.insertWidget(this.#blockFrames.length, blockFrame.getWidget());
    this.#blockFrames.push(blockFrame);
  }

  removeBlockFrame(blockFrame: BlockFrame): void {
    const index = this.#blockFrames.indexOf(blockFrame);
    const widget = blockFrame.getWidget();
    const height = widget.geometry().height();
    this.#boxLayout.removeWidget(widget);
    this.#blockFrames.splice(index, 1);
    this.preMoveScrollPosition(-height);
  }

  preMoveScrollPosition(delta: number): void {
    this.#scrollPosition = Math.max(this.#scrollPosition + delta, 0);
    this.#layout();
  }

  #updateViewportTopOnFrames(): void {
    const value = this.getScrollPosition();
    for (const bf of this.#blockFrames) {
      const widget = bf.getWidget();
      const geo = widget.geometry();
      const offset = value - geo.top();
      bf.setViewportTop(offset);
    }
  }

  #handleWheel(event: QWheelEvent): void {
    let pixelDeltaY = 0;
    const wheelPixelDelta = event.pixelDelta();
    if (wheelPixelDelta != null) {
      pixelDeltaY += wheelPixelDelta.y;
    }
    if (wheelPixelDelta == null || wheelPixelDelta.y === 0) {
      const angleY = event.angleDelta().y;
      pixelDeltaY = Math.round(SCROLL_SCALE * angleY);
    }
    this.setScrollPosition(this.getScrollPosition() - pixelDeltaY);
  }
}
