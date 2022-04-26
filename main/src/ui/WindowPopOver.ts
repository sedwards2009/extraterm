/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, NodeWidget, QWidget, WidgetAttribute, WindowType } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";
import { Tab } from "../Tab.js";
import { Window } from "../Window.js";


export class WindowPopOver {
  private _log: Logger = null;
  #popUp: QWidget = null;

  #children: NodeWidget<any>[];
  #onCloseEventEmitter = new EventEmitter<void>();
  onClose: Event<void> = null;

  constructor(children: NodeWidget<any>[]) {
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
  }

  #onClose(): void {
    this.#onCloseEventEmitter.fire();
  }

  show(window: Window, tab: Tab): void {
    this.#popUp.setNodeParent(window.getWidget());

    const tabRect = window.getTabGlobalGeometry(tab);

    const width = 500;  // px TODO: make it respect DPI
    const leftOffset = (tabRect.width() - width ) /2;

    this.#popUp.setGeometry(tabRect.left() + leftOffset, tabRect.top(), width, tabRect.height());
    this.#popUp.raise();
    this.#popUp.show();
  }

  hide(): void {
    this.#popUp.hide();
    this.#popUp.setNodeParent(null);
  }
}
