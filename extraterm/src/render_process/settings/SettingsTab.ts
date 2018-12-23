/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import {ViewerMetadata, Disposable} from 'extraterm-extension-api';

import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from '../viewers/ViewerElement';
import { AcceptsConfigDatabase, ConfigDatabase } from '../../Config';
import { AcceptsKeybindingsManager, KeybindingsManager } from '../keybindings/KeyBindingsManager';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ThemeTypes from '../../theme/Theme';
import { SettingsUi } from './SettingsUi';
import { AcceptsExtensionManager, ExtensionManager } from '../extension/InternalTypes';
import { dispatchCommandPaletteRequest, COMMAND_OPEN_COMMAND_PALETTE, dispatchContextMenuRequest, COMMAND_OPEN_CONTEXT_MENU } from '../command/CommandUtils';
import { Commandable, BoundCommand } from '../command/CommandTypes';
import * as SupportsDialogStack from "../SupportsDialogStack";


const SETTINGS_TAB = "settings-tab";
const CLASS_VISITOR_DIALOG = "CLASS_VISITOR_DIALOG";


@WebComponent({tag: "et-settings-tab"})
export class SettingsTab extends ViewerElement implements Commandable, AcceptsConfigDatabase,
    AcceptsExtensionManager, AcceptsKeybindingsManager, SupportsDialogStack.SupportsDialogStack {
  
  static TAG_NAME = "ET-SETTINGS-TAB";
  
  private _log: Logger = null;
  private _ui: SettingsUi = null;
  private _themes: ThemeTypes.ThemeInfo[] = [];
  private _keybindingsManager: KeybindingsManager = null;
  private _dialogStack: HTMLElement[] = [];

  constructor() {
    super();
    this._log = getLogger(SettingsTab.TAG_NAME, this);

    this._ui = new SettingsUi();
    const component = this._ui.$mount();

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    const themeStyle = document.createElement("style");
    themeStyle.id = ThemeableElementBase.ID_THEME;

    shadow.appendChild(themeStyle);
    
    this.updateThemeCss();
    
    shadow.appendChild(component.$el);
    component.$el.addEventListener('keydown', ev => this._handleKeyDownCapture(ev), true);
    component.$el.addEventListener('contextmenu', ev => this._handleContextMenuCapture(ev), true);
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Settings";
    metadata.icon = "extraicon extraicon-pocketknife";
    return metadata;
  }

  setSelectedTab(tabName: string): void {
    this._ui.selectedTab = tabName;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.SETTINGS_TAB, ThemeTypes.CssFile.FONT_AWESOME];
  }

  hasFocus(): boolean {
    // const root = util.getShadowRoot(this);
    // return root.activeElement !== null;
    return false;
  }

  setConfigDatabase(configDatabase: ConfigDatabase): void {
    this._ui.setConfigDatabase(configDatabase);
  }
  
  setKeybindingsManager(newKeybindingsManager: KeybindingsManager): void {
    this._keybindingsManager = newKeybindingsManager;
    this._ui.setKeybindingsManager(newKeybindingsManager);
  }

  setExtensionManager(extensionManager: ExtensionManager): void {
    this._ui.setExtensionManager(extensionManager);
  }
  
  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._ui.themes = themes;
  }

  private _handleKeyDownCapture(ev: KeyboardEvent): void {
    if (this._keybindingsManager === null || this._keybindingsManager.getKeybindingsContexts() === null) {
      return;
    }

    const keyBindings = this._keybindingsManager.getKeybindingsContexts().context(SETTINGS_TAB);
    const command = keyBindings.mapEventToCommand(ev);
    if (this._executeCommand(command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
  
  private _handleContextMenuCapture(ev: MouseEvent): void {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    this.executeCommand(COMMAND_OPEN_CONTEXT_MENU, { x: ev.clientX, y: ev.clientY});
  }

  getCommands(commandableStack: Commandable[]): BoundCommand[] {
    const entries: BoundCommand[] = [];
    return entries;
  }

  executeCommand(commandId: string, commandArguments?: any): void {
    this._executeCommand(commandId, commandArguments);
  }
  
  private _executeCommand(command: string, commandArguments?: any): boolean {
    switch (command) {
      case COMMAND_OPEN_COMMAND_PALETTE:
        dispatchCommandPaletteRequest(this);
        return true;

      case COMMAND_OPEN_CONTEXT_MENU:
        dispatchContextMenuRequest(this, commandArguments.x, commandArguments.y);
        return true;
      default:
        return false;
    }
  }

  showDialog(dialogElement: HTMLElement): Disposable {
    const containerDiv = this._ui.$el;
    dialogElement.classList.add(CLASS_VISITOR_DIALOG);
    containerDiv.appendChild(dialogElement);
    this._dialogStack.push(dialogElement);
    return {
      dispose: () => {
        dialogElement.classList.remove(CLASS_VISITOR_DIALOG);
        this._dialogStack = this._dialogStack.filter(el => el !== dialogElement);
        containerDiv.removeChild(dialogElement);
      }
    };
  }

}
