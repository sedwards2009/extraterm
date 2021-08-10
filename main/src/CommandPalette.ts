
/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { Direction, QStackedWidget, QTabBar, QFrame, QWidget, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction,
  QDialog, FocusPolicy, QKeyEvent, WidgetAttribute, QIcon, WindowType } from "@nodegui/nodegui";
import { BoxLayout, StackedWidget, Menu, TabBar, ToolButton, Widget } from "qt-construct";
import { Tab } from "./Tab";
import { Window } from "./Window";


export class CommandPalette {
  private _log: Logger = null;

  #popUp: QFrame = null;

  constructor(parent: QWidget) {
    this._log = getLogger("CommandPalette", this);

    this.#popUp = new QFrame(parent);
    this.#popUp.setWindowFlag(WindowType.Popup, true);
    this.#popUp.setAttribute(WidgetAttribute.WA_WindowPropagation, true);
    this.#popUp.setAttribute(WidgetAttribute.WA_X11NetWmWindowTypePopupMenu, true);
  }

  show(window: Window, tab: Tab): void {
    this.#popUp.setNodeParent(window.getWidget());

    const tabRect = window.getTabGlobalGeometry(tab);
this._log.debug(`tabRect.left: ${tabRect.left()}, tabRect.top: ${tabRect.top()}, tabRect.width: ${tabRect.width()}, tabRect.height: ${tabRect.height()}`);

    this.#popUp.setGeometry(tabRect.left(), tabRect.top(), tabRect.width(), tabRect.height());
    this.#popUp.raise();
    this.#popUp.show();
  }
}
