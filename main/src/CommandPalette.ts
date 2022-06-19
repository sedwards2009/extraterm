/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { doLater } from "extraterm-timeoutqt";
import { Label } from "qt-construct";
import { Tab } from "./Tab.js";
import { Window } from "./Window.js";
import { ExtensionManager } from "./InternalTypes.js";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager.js";
import { Entry, FieldType, ListPicker } from "./ui/ListPicker.js";
import { UiStyle } from "./ui/UiStyle.js";
import { WindowPopOver } from "./ui/WindowPopOver.js";
import { QRect, WidgetEventTypes } from "@nodegui/nodegui";


export class CommandPalette {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #listPicker: ListPicker = null;
  #windowPopOver: WindowPopOver = null;
  #containingRect: QRect = null;
  #listPickerAfterLayoutFunc: () => void = null;

  constructor(extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager, uiStyle: UiStyle) {
    this._log = getLogger("CommandPalette", this);
    this.#uiStyle = uiStyle;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;

    this.#createPopOver();
  }

  #createPopOver(): void {
    this.#listPicker = new ListPicker(this.#uiStyle);
    this.#windowPopOver = new WindowPopOver([
      Label({text: "Command Palette"}),
      this.#listPicker.getWidget()
    ]);
    this.#listPicker.onSelected((id: string) => this.#commandSelected(id));
    this.#listPicker.onContentAreaChanged(() => this.#updateHeight());
    this.#listPicker.getWidget().addEventListener(WidgetEventTypes.LayoutRequest, () => {
      if (this.#listPickerAfterLayoutFunc == null) {
        return;
      }
      this.#listPickerAfterLayoutFunc();
      this.#listPickerAfterLayoutFunc = null;
    });
  }

  #updateHeight(): void {
    if (this.#containingRect == null) {
      return;
    }
    const contentHeight = this.#listPicker.getContentsHeight();
    const maxListAreaHeight = Math.floor(this.#containingRect.height() * 0.8);
    if (contentHeight > maxListAreaHeight) {
      // Limit the pop up window height and allow contents to scroll
      this.#listPicker.clearListAreaFixedHeight();
      this.#windowPopOver.clearFixedHeight();
      this.#listPickerAfterLayoutFunc = null;
    } else {
      // Shrink the list picker area to match the contents, and shrink the window height to match.
      this.#listPicker.setListAreaFixedHeight(contentHeight);
      this.#listPickerAfterLayoutFunc = () => {
        this.#windowPopOver.setFixedHeightToSizeHint();
      };
    }
  }

  show(window: Window, tab: Tab): void {
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

    this.#containingRect = window.getTabGlobalGeometry(tab);
    this.#windowPopOver.position(window, {
        containingRect: window.getTabGlobalGeometry(tab)
    });
    this.#updateHeight();
    this.#windowPopOver.show();
    this.#listPicker.focus();
  }

  hide(): void {
    this.#windowPopOver.hide();
  }

  #commandSelected(id: string): void {
    this.hide();
    doLater( () => {
      try {
        this.#containingRect = null;
        this.#listPickerAfterLayoutFunc = null;
        this.#extensionManager.executeCommand(id);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }
}
