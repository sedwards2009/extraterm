/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { WebComponent } from 'extraterm-web-component-decorators';

import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import {ListPicker} from '../gui/ListPicker';
import * as DomUtils from '../DomUtils';
import {commandPaletteFilterEntries, commandPaletteFormatEntries } from './CommandPalette';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import { CommandMenuItem } from './CommandTypes';

const ID_CLOSE_BUTTON = "ID_CLOSE_BUTTON";
const ID_CONTAINER = "ID_CONTAINER";
const ID_EMPTY_PANE_MENU = "ID_EMPTY_PANE_MENU";
const ID_LIST_PICKER = "ID_LIST_PICKER";
const ID_TITLE = "ID_TITLE";


/**
 * The Extraterm Empty Pane Menu.
 */
@WebComponent({tag: "et-empty-pane-menu"})
export class EmptyPaneMenu extends ThemeableElementBase {
  
  static TAG_NAME = "ET-EMPTY-PANE-MENU";

  private _log: Logger;
  private _entries: CommandMenuItem[] = [];

  constructor() {
    super();
    this._log = getLogger(EmptyPaneMenu.TAG_NAME, this);
  }
  
  /**
   * Custom Element 'connected' life cycle hook.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) == null) {
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
      const themeStyle = document.createElement('style');
      themeStyle.id = ThemeableElementBase.ID_THEME;
      
      const divContainer = document.createElement('div');
      divContainer.id = ID_EMPTY_PANE_MENU;
      divContainer.innerHTML = trimBetweenTags(`<div id="${ID_CONTAINER}">
        <div id="${ID_TITLE}" class="gui-packed-row">
          <span class="expand">Pane Menu</span>
          <button id="${ID_CLOSE_BUTTON}" class="compact microtool danger"><i class="fa fa-times"></i></button>
        </div>
        <${ListPicker.TAG_NAME} id="${ID_LIST_PICKER}"></${ListPicker.TAG_NAME}>
      </div>
      `);

      shadow.appendChild(themeStyle);
      shadow.appendChild(divContainer);    

      const listPicker = <ListPicker<CommandMenuItem>> DomUtils.getShadowId(this, ID_LIST_PICKER);
      listPicker.addEventListener("selected", (ev: CustomEvent): void => {
        const event = new CustomEvent("selected", { detail: {selected: ev.detail.selected } });
        this.dispatchEvent(event);
      });

      listPicker.setFilterAndRankEntriesFunc(commandPaletteFilterEntries);
      listPicker.setFormatEntriesFunc(commandPaletteFormatEntries);
      listPicker.addExtraCss([ThemeTypes.CssFile.COMMAND_PALETTE]);
      
      listPicker.setEntries(this._entries);
      
      const closeButton = DomUtils.getShadowId(this, ID_CLOSE_BUTTON);
      closeButton.addEventListener('click', () => {
        const event = new CustomEvent("selected", { detail: {selected: 'closePane' } });
        this.dispatchEvent(event);
      });

      this.updateThemeCss();
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.EMPTY_PANE_MENU];
  }

  focus(): void {
    const listPicker = DomUtils.getShadowId(this, ID_LIST_PICKER);
    if (listPicker != null) {
      listPicker.focus();
    }
  }

  hasFocus(): boolean {
    return false;
  }

  setEntries(entries: CommandMenuItem[]): void {
    this._entries = entries;
    
    if (DomUtils.getShadowRoot(this) != null) {
      const listPicker = <ListPicker<CommandMenuItem>> DomUtils.getShadowId(this, ID_LIST_PICKER);
      listPicker.setEntries(entries);
    }
  }

  getEntries(): CommandMenuItem[] {
    return this._entries;
  }

  getFilter(): string {
    const listPicker = <ListPicker<CommandMenuItem>> DomUtils.getShadowId(this, ID_LIST_PICKER);
    return listPicker.getFilter();
  }

  setFilter(text: string): void {
    const listPicker = <ListPicker<CommandMenuItem>> DomUtils.getShadowId(this, ID_LIST_PICKER);
    listPicker.setFilter(text);
  }
}
