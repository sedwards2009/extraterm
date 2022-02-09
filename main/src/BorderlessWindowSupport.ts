/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { CursorShape, Edge, QMouseEvent, QWidget, WidgetEventTypes, WindowState, WindowType } from "@nodegui/nodegui";
import { Logger, log, getLogger } from "extraterm-logging";

const RESIZE_BORDER_SIZE = 8;


export class BorderlessWindowSupport {
  private _log: Logger = null;

  #windowWidget: QWidget = null;

  #boundOnMouseButtonPress: (nativeEvent) => void = null;
  #boundOnMouseMove: (nativeEvent) => void = null;
  #isCursorChanged = false;

  constructor(windowWidget: QWidget) {
    this._log = getLogger("BorderlessWindowSupport", this);
    this.#windowWidget = windowWidget;
    this.#boundOnMouseButtonPress = this.#onMouseButtonPress.bind(this);
    this.#boundOnMouseMove = this.#onMouseMove.bind(this);
  }

  enable(): void {
    const isVisible = this.#windowWidget.isVisible();
    if (isVisible) {
      this.#windowWidget.hide();
    }

    this.#windowWidget.setWindowFlag(WindowType.FramelessWindowHint, true);
    this.#windowWidget.winId();
    const windowHandle = this.#windowWidget.windowHandle();
    windowHandle.addEventListener(WidgetEventTypes.MouseButtonPress, this.#boundOnMouseButtonPress);
    windowHandle.addEventListener(WidgetEventTypes.MouseMove, this.#boundOnMouseMove);

    if (isVisible) {
      this.#windowWidget.show();
    }
  }

  disable(): void {
    const isVisible = this.#windowWidget.isVisible();
    if (isVisible) {
      this.#windowWidget.hide();
    }

    this.#windowWidget.setWindowFlag(WindowType.FramelessWindowHint, false);
    this.#windowWidget.winId();

    const windowHandle = this.#windowWidget.windowHandle();
    windowHandle.removeEventListener(WidgetEventTypes.MouseButtonPress, this.#boundOnMouseButtonPress);
    windowHandle.removeEventListener(WidgetEventTypes.MouseMove, this.#boundOnMouseMove);

    if (isVisible) {
      this.#windowWidget.show();
    }
  }

  #onMouseButtonPress(nativeEvent): void {
    const windowState = this.#windowWidget.windowHandle().windowState();
    if (windowState !== WindowState.WindowNoState) {
      return;
    }

    const event = new QMouseEvent(nativeEvent);
    // this._log.debug(`onMouseButtonPress (${event.x()}, ${event.y()})`);
    const edge = this.#hitTestEdge(event.x(), event.y());
    if (edge === 0) {
      return;
    }
    this.#windowWidget.windowHandle().startSystemResize(edge);
    this.#windowWidget.setEventProcessed(true);
  }

  #hitTestEdge(localX: number, localY: number): Edge | 0 {
    const windowSize = this.#windowWidget.size();
    let result = 0;
    if (localX <= RESIZE_BORDER_SIZE) {
      result |= Edge.LeftEdge;
    } else if (localX >= windowSize.width() - RESIZE_BORDER_SIZE) {
      result |= Edge.RightEdge;
    }
    if (localY <= RESIZE_BORDER_SIZE) {
      result |= Edge.TopEdge;
    } else if (localY >= windowSize.height() - RESIZE_BORDER_SIZE) {
      result |= Edge.BottomEdge;
    }
    return result;
  }

  #onMouseMove(nativeEvent): void {
    const windowState = this.#windowWidget.windowHandle().windowState();
    if (windowState !== WindowState.WindowNoState) {
      if (this.#isCursorChanged) {
        this.#windowWidget.setCursor(CursorShape.ArrowCursor);
        this.#isCursorChanged = false;
      }
      return;
    }

    const event = new QMouseEvent(nativeEvent);
    // this._log.debug(`onMouseMove (${event.x()}, ${event.y()})`);
    const edge = this.#hitTestEdge(event.x(), event.y());
    switch (edge) {
      case Edge.LeftEdge:
      case Edge.RightEdge:
        this.#windowWidget.setCursor(CursorShape.SizeHorCursor);
        this.#isCursorChanged = true;
        break;

      case Edge.TopEdge | Edge.LeftEdge:
      case Edge.BottomEdge | Edge.RightEdge:
        this.#windowWidget.setCursor(CursorShape.SizeFDiagCursor);
        this.#isCursorChanged = true;
        break;

      case Edge.TopEdge | Edge.RightEdge:
      case Edge.BottomEdge | Edge.LeftEdge:
        this.#windowWidget.setCursor(CursorShape.SizeBDiagCursor);
        this.#isCursorChanged = true;
        break;

      case Edge.TopEdge:
      case Edge.BottomEdge:
        this.#windowWidget.setCursor(CursorShape.SizeVerCursor);
        this.#isCursorChanged = true;
        break;

      default:
        if (this.#isCursorChanged) {
          this.#windowWidget.setCursor(CursorShape.ArrowCursor);
          this.#isCursorChanged = false;
        }
        break;
    }
  }
}
