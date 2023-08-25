/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Direction, QSizePolicyPolicy, QWidget, QWidgetSignals } from "@nodegui/nodegui";
import { BoxLayout, Label, Widget } from "qt-construct";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Logger, getLogger } from "extraterm-logging";
import { doLater } from "extraterm-timeoutqt";

import { Window } from "./Window.js";
import { Tab } from "./Tab.js";
import { Entry, FieldType, ListPicker } from "./ui/ListPicker.js";
import { UiStyle } from "./ui/UiStyle.js";
import { ExtensionManager } from "./InternalTypes.js";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager.js";
import { CommonExtensionWindowState } from "./extension/CommonExtensionState.js";


export class EmptyPaneTab implements Tab {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #contentWidget: QWidget = null;
  #onWindowTitleChangedEventEmitter = new EventEmitter<string>();
  #listPicker: ListPicker = null;
  #parent: any = null;
  #state: CommonExtensionWindowState = null;

  constructor(extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager, uiStyle: UiStyle) {
    this._log = getLogger("EmptyPaneTab", this);
    this.#uiStyle = uiStyle;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;

    this.#listPicker = new ListPicker(this.#uiStyle);
    this.#contentWidget = Widget({
      cssClass: "window-background",
      contentsMargins: 0,
      sizePolicy: {
        horizontal: QSizePolicyPolicy.Expanding,
        vertical: QSizePolicyPolicy.Expanding
      },
      layout:
        BoxLayout({
          direction: Direction.LeftToRight,
          children: [
            { widget: Widget({}), stretch: 1},
            BoxLayout({
              direction: Direction.TopToBottom,
              children: [
                Label({text: "Pane Menu"}),
                this.#listPicker.getWidget()
              ]
            }),
            { widget: Widget({}), stretch: 1},
          ]
        })
    });
    this.onWindowTitleChanged = this.#onWindowTitleChangedEventEmitter.event;

    this.#listPicker.onSelected((id: string) => this.#commandSelected(id));
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
    this.#listPicker.focus();
  }

  unfocus(): void {
  }

  populateMenu(window: Window): void {
    this.#state = {
      activeBlockFrame: null,
      activeHyperlinkURL: null,
      activeTerminal: null,
      activeTab: this,
      activeWindow: window
    };

    const commands = this.#extensionManager.queryCommandsWithExtensionWindowState({
      commandPalette: true,
      categories: ["application", "window", "terminal", "viewer"],
      when: true
    }, this.#state);

    const termKeybindingsMapping = this.#keybindingsIOManager.getCurrentKeybindingsMapping();
    const entries = commands.map((command): Entry => {
      const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(command.command);
      const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
      return {
        id: command.command,
        searchText: command.title,
        fields: [
          command.icon,
          command.title,
          shortcut
        ],
      };
    });

    this.#listPicker.setEntries([FieldType.ICON_NAME, FieldType.TEXT, FieldType.SECONDARY_TEXT_RIGHT], entries);
  }

  getWindowTitle(): string {
    return "Extraterm";
  }

  setWindowTitle(title: string): void {
  }
  onWindowTitleChanged: Event<string>;

  setParent(parent: any) {
    this.#parent = parent;
  }

  getParent() {
    return this.#parent;
  }

  dispose(): void {
  }

  #commandSelected(id: string): void {
    doLater( () => {
      try {
        this.#extensionManager.executeCommandWithExtensionWindowState(this.#state, id);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }

}
