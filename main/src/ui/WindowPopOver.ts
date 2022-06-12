/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, QWidget, WidgetAttribute, WindowType } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";
import { Tab } from "../Tab.js";
import { Window } from "../Window.js";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export class WindowPopOver {
  private _log: Logger = null;
  #popUp: QWidget = null;

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

  show(window: Window, tab: Tab): void {
    const tabRect = window.getTabGlobalGeometry(tab);

    const width = Math.round(500 * window.getDpi() / 96);
    const leftOffset = (tabRect.width() - width ) /2;

    const pos = this.#keepOnScreen(window, {
      left: tabRect.left() + leftOffset,
      top: tabRect.top(),
      width,
      height: tabRect.height()
    });

    this.#popUp.setGeometry(pos.left, pos.top, pos.width, pos.height);
    this.#popUp.raise();
    this.#popUp.show();
  }

  hide(): void {
    this.#popUp.hide();
  }

  #keepOnScreen(window: Window, rect: Rect): Rect {
    const screen = window.getWidget().windowHandle().screen();
    const size = screen.size();
    const width = Math.min(rect.width, size.width());
    const height = Math.min(rect.height, size.height());
    const left = Math.min(size.width() - width, rect.left);
    const top = Math.min(size.height() - height, rect.top);
    return {
      left,
      top,
      width,
      height
    };
  }
}
