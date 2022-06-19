/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, QRect, QWidget, WidgetAttribute, WindowType } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";
import { Window } from "../Window.js";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface WindowPopOverOptions {
  containingRect: QRect;
}

export class WindowPopOver {
  private _log: Logger = null;
  #popUp: QWidget = null;
  #defaultPosition: Rect = null;

  #children: QWidget[];
  #onCloseEventEmitter = new EventEmitter<void>();
  onClose: Event<void> = null;

  constructor(children: QWidget[]) {
    this._log = getLogger("WindowPopover", this);
    this.onClose = this.#onCloseEventEmitter.event;
    this.#children = children;
    this.#createPopUp();
  }

  #createPopUp(): void {
    this.#popUp = Widget({
      cssClass: ["list-picker"],
      windowFlag: WindowType.Popup,
      attribute: [WidgetAttribute.WA_WindowPropagation, WidgetAttribute.WA_X11NetWmWindowTypePopupMenu],
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: this.#children
      }),
      onClose: this.#onClose.bind(this)
    });
    this.#popUp.hide();
  }

  #onClose(): void {
    this.#onCloseEventEmitter.fire();
  }

  setFixedHeight(height: number): void {
    this.#popUp.setFixedHeight(height);
  }

  setFixedHeightToSizeHint(): void {
    const hint = this.#popUp.sizeHint();
    this.#popUp.setFixedHeight(hint.height());
  }

  clearFixedHeight(): void {
    this.#popUp.setMinimumHeight(0);
    this.#popUp.setMaximumHeight(16777215);

    const pos = this.#defaultPosition;
    this.#popUp.setGeometry(pos.left, pos.top, pos.width, pos.height);
  }

  position(window: Window, options?: WindowPopOverOptions): void {
    let tabRect: QRect;
    if (options?.containingRect != null) {
      tabRect = options.containingRect;
    } else {
      tabRect = window.getWidget().geometry();
    }

    const width = Math.round(500 * window.getDpi() / 96);
    const leftOffset = (tabRect.width() - width ) /2;

    this.#defaultPosition = this.#keepOnScreen(window, {
      left: tabRect.left() + leftOffset,
      top: tabRect.top(),
      width,
      height: tabRect.height()
    });
    const pos = this.#defaultPosition;
    this.#popUp.setGeometry(pos.left, pos.top, pos.width, pos.height);
  }

  show(): void {
    this.#popUp.raise();
    this.#popUp.show();
  }

  hide(): void {
    this.#popUp.hide();
  }

  #keepOnScreen(window: Window, rect: Rect): Rect {
    const screen = window.getWidget().windowHandle().screen();
    const screenGeometry = screen.geometry();
    const width = Math.min(rect.width, screenGeometry.width());
    const height = Math.min(rect.height, screenGeometry.height());
    const left = Math.max(0, Math.min(screenGeometry.width() - width, rect.left - screenGeometry.left()));
    const top = Math.max(0, Math.min(screenGeometry.height() - height, rect.top - screenGeometry.top()));
    return {
      left: left + screenGeometry.left(),
      top: top + screenGeometry.top(),
      width,
      height
    };
  }
}
