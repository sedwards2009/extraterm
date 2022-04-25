/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { doLater } from "extraterm-timeoutqt";
import { Direction, QWidget, WidgetAttribute, WindowType } from "@nodegui/nodegui";
import { BoxLayout, Widget, Label } from "qt-construct";
import { Tab } from "./Tab.js";
import { Window } from "./Window.js";
import { ExtensionManager } from "./InternalTypes.js";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager.js";
import { Entry, FieldType, ListPicker } from "./ui/ListPicker.js";
import { UiStyle } from "./ui/UiStyle.js";


export class CommandPalette {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;

  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #listPicker: ListPicker = null;
  #popUp: QWidget = null;

  constructor(extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager, uiStyle: UiStyle) {
    this._log = getLogger("CommandPalette", this);
    this.#uiStyle = uiStyle;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;

    this.#createPopUp();
  }

  #createPopUp(): void {
    this.#listPicker = new ListPicker(this.#uiStyle);

    this.#popUp = Widget({
      cssClass: ["list-picker"],
      windowFlag: WindowType.Popup,
      attribute: [WidgetAttribute.WA_WindowPropagation, WidgetAttribute.WA_X11NetWmWindowTypePopupMenu],
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: [
          Label({text: "Command Palette"}),
          this.#listPicker.getWidget()
        ]
      })
    });
    this.#listPicker.onSelected((id: string) => this.#commandSelected(id));
  }

  show(window: Window, tab: Tab): void {
    this.#popUp.setNodeParent(window.getWidget());

    const commands = this.#extensionManager.queryCommands({
      commandPalette: true,
      categories: ["application", "window", "terminal", "viewer"],
      when: true
    });

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

    const tabRect = window.getTabGlobalGeometry(tab);

    const width = 500;  // px TODO: make it respect DPI
    const leftOffset = (tabRect.width() - width ) /2;

    this.#popUp.setGeometry(tabRect.left() + leftOffset, tabRect.top(), width, tabRect.height());
    this.#popUp.raise();
    this.#popUp.show();
    this.#listPicker.focus();
  }

  hide(): void {
    this.#popUp.hide();
  }

  #commandSelected(id: string): void {
    this.hide();
    doLater( () => {
      try {
        this.#extensionManager.executeCommand(id);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }
}
