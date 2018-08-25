/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import {ViewerMetadata, Disposable} from 'extraterm-extension-api';

import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from '../viewers/ViewerElement';
import { AcceptsConfigDatabase, ConfigDatabase } from '../../Config';
import { AcceptsKeyBindingsManager, KeyBindingsManager } from '../keybindings/KeyBindingsManager';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ThemeTypes from '../../theme/Theme';
import { SettingsUi } from './SettingsUi';
import { AcceptsExtensionManager, ExtensionManager } from '../extension/InternalTypes';
import { Commandable, dispatchCommandPaletteRequest, CommandEntry, COMMAND_OPEN_COMMAND_PALETTE } from '../CommandPaletteRequestTypes';
import * as SupportsDialogStack from "../SupportsDialogStack";


const SETTINGS_TAB = "settings-tab";
const CLASS_VISITOR_DIALOG = "CLASS_VISITOR_DIALOG";


@WebComponent({tag: "et-settings-tab"})
export class SettingsTab extends ViewerElement implements Commandable, AcceptsConfigDatabase,
    AcceptsExtensionManager, AcceptsKeyBindingsManager, SupportsDialogStack.SupportsDialogStack {
  
  static TAG_NAME = "ET-SETTINGS-TAB";
  
  private _log: Logger = null;
  private _ui: SettingsUi = null;
  private _themes: ThemeTypes.ThemeInfo[] = [];
  private _keyBindingManager: KeyBindingsManager = null;
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
    metadata.icon = "fa fa-wrench";
    return metadata;
  }

  setSelectedTab(tabName: string): void {
    this._ui.selectedTab = tabName;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.SETTINGS_TAB, ThemeTypes.CssFile.FONT_AWESOME];
  }

  hasFocus(): boolean {
    // const root = util.getShadowRoot(this);
    // return root.activeElement !== null;
    return false;
  }

  setConfigDatabase(configDatabase: ConfigDatabase): void {
    this._ui.setConfigDatabase(configDatabase);
  }
  
  setKeyBindingsManager(newKeyBindingManager: KeyBindingsManager): void {
    this._keyBindingManager = newKeyBindingManager;
    this._ui.setKeyBindingsManager(newKeyBindingManager);
  }

  setExtensionManager(extensionManager: ExtensionManager): void {
    this._ui.setExtensionManager(extensionManager);
  }
  
  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._ui.themes = themes;
  }

  private _handleKeyDownCapture(ev: KeyboardEvent): void {
    if (this._keyBindingManager === null || this._keyBindingManager.getKeyBindingsContexts() === null) {
      return;
    }

    const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(SETTINGS_TAB);
    const command = keyBindings.mapEventToCommand(ev);
    if (this._executeCommand(command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
  
  private _handleContextMenuCapture(ev: MouseEvent): void {
    ev.stopImmediatePropagation();
    ev.preventDefault();

    this.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
  }

  getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[] {
    const entries: CommandEntry[] = [];
    return entries;
  }

  executeCommand(commandId: string): void {
    this._executeCommand(commandId);
  }
  
  private _executeCommand(command: string): boolean {
    if (command === COMMAND_OPEN_COMMAND_PALETTE) {
      dispatchCommandPaletteRequest(this);
      return true;
    }

    return false;
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
