/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "extraterm-event-emitter";
import { QWidget } from "@nodegui/nodegui";

import { TabTitleWidgetFactory } from "./Tab.js";
import { Terminal } from "./Terminal.js";
import { TerminalThemeProvider } from "./TerminalTheme.js";
import { Style } from "./Style.js";


export interface Windows {
  registerTabTitleWidget(name: string, factory: TabTitleWidgetFactory): void;
  registerTerminalThemeProvider(name: string, provider: TerminalThemeProvider): void;
}

/**
 * Extensions use an instance of this to build thier own tab.
 *
 * Instances of this are created via `Window.createExtensionTab()`.
 *
 * `open()` must be called before the tab is visible in the GUI.
 */
export interface ExtensionTab {
  /**
   * Assign a QWidget to this property to set the contexts of the tab.
   */
  contentWidget: QWidget;

  /**
   * Fired when the tab is closed
   */
  onDidClose: Event<void>;

  /**
   * Make the tab visible and give it the focus
   *
   * If the tab is already open then it will be made visible and receive the
   * focus.
   */
  open(): void;

  /**
   * Close the tab by removing it from the GUI
   *
   * A closed tab can be reopened with `open()`.
   */
  close(): void;

  /**
   * Icon to display next to the title
   *
   * Extraterm ships with the free Font Awesome 5 icons. Icons and thier
   * names can be found at https://fontawesome.com/icons?d=gallery&p=2&m=free
   * The value for `icon` should be that shown in the `class` attribute in
   * the icon example HTML. For example: `fa-bolt` or 'fa-lightbulb'.
   */
  icon: string;

  /**
   * Title to display for this tab at the top
   */
  title: string;
}

export interface Window {

  readonly terminals: Terminal[];

  readonly onDidClose: Event<Window>;

  /**
   * Create a blank instance of tab
   *
   * Extension tabs are defined and named in the extension's `package.json`.
   */
  createExtensionTab(name: string): ExtensionTab;

  readonly style: Style;
}
