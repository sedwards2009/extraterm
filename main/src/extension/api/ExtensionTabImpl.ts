/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { Direction, QBoxLayout, QWidget } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";

import { Tab } from "../../Tab.js";
import { Window } from "../../Window.js";
import { ErrorTolerantEventEmitter } from "../ErrorTolerantEventEmitter.js";


export class ExtensionTabBridge implements Tab {
  iconName: string = "";
  title: string = "";

  #parent: any = null;
  #onWindowTitleChangedEventEmitter = new EventEmitter<string>();
  onWindowTitleChanged: ExtensionApi.Event<string> = null;

  #onDidCloseEventEmitter: ErrorTolerantEventEmitter<void> = null;

  #extensionTabImpl: ExtensionTabImpl;
  #containerWidget: QWidget;
  #containerLayout: QBoxLayout;
  #extensionWidget: QWidget = null;
  #window: Window;
  #windowTitle = "";

  #isOpen = false;

  constructor(window: Window, log: ExtensionApi.Logger) {
    this.onWindowTitleChanged = this.#onWindowTitleChangedEventEmitter.event;
    this.#onDidCloseEventEmitter = new ErrorTolerantEventEmitter<void>("onDidClose", log);
    this.#window = window;
    this.#extensionTabImpl = new ExtensionTabImpl(this);
    this.#window.onTabCloseRequest((t: Tab) => {
      if (t === this) {
        this.close();
        this.#onDidCloseEventEmitter.fire();
      }
    });
    this.#containerWidget = Widget({
      contentsMargins: 0,
      cssClass: "background",
      layout: this.#containerLayout = BoxLayout({
        direction: Direction.TopToBottom,
        spacing: 0,
        children: []
      })
    });
  }

  dispose(): void {
  }

  setParent(parent: any): void {
    this.#parent = parent;
  }

  getParent(): any {
    return this.#parent;
  }

  getIconName(): string {
    return this.iconName;
  }

  getTitle(): string {
    return this.title;
  }

  getTabWidget(): QWidget {
    return null;
  }

  getContents(): QWidget {
    return this.#containerWidget;
  }

  getOnDidCloseEvent(): ExtensionApi.Event<void> {
    return this.#onDidCloseEventEmitter.event;
  }

  setContentWidget(contentWidget: QWidget): void {
    if (this.#extensionWidget != null) {
      this.#extensionWidget.setParent(null);
    }
    this.#containerLayout.addWidget(contentWidget);
    this.#extensionWidget = contentWidget;
  }

  setIsCurrent(isCurrent: boolean): void {
  }

  focus(): void {
  }

  unfocus(): void {
    // TODO
  }

  setWindowTitle(title: string): void {
    this.#windowTitle = title;
    this.#onWindowTitleChangedEventEmitter.fire(title);
  }

  getWindowTitle(): string {
    return this.#windowTitle;
  }

  getExtensionTabImpl(): ExtensionTabImpl {
    return this.#extensionTabImpl;
  }

  open(): void {
    if (!this.#isOpen) {
      this.#window.addTab(this);
    }
    this.#window.focus();
    this.#window.focusTab(this);
    this.#isOpen = true;
  }

  close(): void {
    if (!this.#isOpen) {
      return;
    }
    this.#window.removeTab(this);
    this.#isOpen = false;
  }
}


export class ExtensionTabImpl implements ExtensionApi.ExtensionTab {

  #extensionTabBridge: ExtensionTabBridge;

  constructor(extensionTabBridge: ExtensionTabBridge) {
    this.#extensionTabBridge = extensionTabBridge;
  }

  set contentWidget(contentWidget: QWidget) {
    this.#extensionTabBridge.setContentWidget(contentWidget);
  }

  get icon(): string {
    return this.#extensionTabBridge.iconName;
  }

  set icon(icon: string) {
    this.#extensionTabBridge.iconName = icon;
  }

  get title(): string {
    return this.#extensionTabBridge.title;
  }

  set title(title: string) {
    this.#extensionTabBridge.title = title;
  }

  get onDidClose(): ExtensionApi.Event<void> {
    return this.#extensionTabBridge.getOnDidCloseEvent();
  }

  open(): void {
    this.#extensionTabBridge.open();
  }

  close(): void {
    this.#extensionTabBridge.close();
  }
}
