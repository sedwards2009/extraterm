/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { QWidget, QWidgetSignals } from "@nodegui/nodegui";
import { Widget } from "qt-construct";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Logger, getLogger } from "extraterm-logging";

import { Tab } from "./Tab.js";


export class EmptyPaneTab implements Tab {
  private _log: Logger = null;

  #contentWidget: QWidget = null;
  #onWindowTitleChangedEventEmitter = new EventEmitter<string>();

  constructor() {
    this._log = getLogger("EmptyPaneTab", this);

    this.#contentWidget = Widget({
      cssClass: "window-background"
    });
    this.onWindowTitleChanged = this.#onWindowTitleChangedEventEmitter.event;
  }

  getIconName(): string {
    return null;
  }

  getTitle(): string {
    return "<empty pane tab>";
  }

  getContents(): QWidget<QWidgetSignals> {
    return this.#contentWidget;
  }

  getTabWidget(): QWidget<QWidgetSignals> {
    return null;
  }

  setIsCurrent(isCurrent: boolean): void {
  }

  focus(): void {
  }

  unfocus(): void {
  }

  getWindowTitle(): string {
    return "Extraterm";
  }

  setWindowTitle(title: string): void {
  }
  onWindowTitleChanged: Event<string>;

  setParent(parent: any) {
  }

  getParent() {
    return null;
  }

  dispose(): void {
  }
}
