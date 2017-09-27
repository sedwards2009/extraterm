/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Empty Pane Menu tab

"use strict";

import * as ThemeTypes from '../Theme';
import {ThemeableElementBase} from './ThemeableElementBase';
import {ListPicker} from './gui/ListPicker';
import * as DomUtils from './DomUtils';
import {commandPaletteFilterEntries, commandPaletteFormatEntries, CommandMenuItem} from './CommandPaletteFunctions';
import {Logger, getLogger} from '../logging/Logger';
import log from '../logging/LogDecorator';

const ID_CLOSE_BUTTON = "ID_CLOSE_BUTTON";
const ID_CONTAINER = "ID_CONTAINER";
const ID_EMPTY_PANE_MENU = "ID_EMPTY_PANE_MENU";
const ID_LIST_PICKER = "ID_LIST_PICKER";
const ID_TITLE = "ID_TITLE";

let registered = false;

ListPicker.init();

/**
 * The Extraterm Empty Pane Menu.
 */
export class EmptyPaneMenu extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-EMPTY-PANE-MENU";

  /**
   * Initialize the EmptyPaneMenu class and resources.
   *
   * When EmptyPaneMenu is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.customElements.define(EmptyPaneMenu.TAG_NAME.toLowerCase(), EmptyPaneMenu);
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _log: Logger;
  
  private _entries: CommandMenuItem[];

  private _selectedId: string;

  private _initProperties(): void {
    this._log = getLogger(EmptyPaneMenu.TAG_NAME, this);
    this._entries = [];
    this._selectedId = null;
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                
  // #     # #    # #####  #      #  ####  
  // #     # #    # #    # #      # #    # 
  // ######  #    # #####  #      # #      
  // #       #    # #    # #      # #      
  // #       #    # #    # #      # #    # 
  // #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------

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
    this._selectedId = null;
    
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

  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------

  constructor() {
    super();
    this._initProperties();
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
      divContainer.innerHTML = `<div id="${ID_CONTAINER}">
        <div id="${ID_TITLE}">Pane Menu<button id=${ID_CLOSE_BUTTON}><i class="fa fa-times"></i></button></div>
        <${ListPicker.TAG_NAME} id="${ID_LIST_PICKER}"></${ListPicker.TAG_NAME}>
        
      </div>
      `;

      shadow.appendChild(themeStyle);
      shadow.appendChild(divContainer);    

      const listPicker = <ListPicker<CommandMenuItem>> DomUtils.getShadowId(this, ID_LIST_PICKER);
      listPicker.addEventListener("selected", (ev: CustomEvent): void => {
        const event = new CustomEvent("selected", { detail: {selected: ev.detail.selected } });
        this.dispatchEvent(event);
      });

      listPicker.setFilterAndRankEntriesFunc(commandPaletteFilterEntries);
      listPicker.setFormatEntriesFunc(commandPaletteFormatEntries);
      listPicker.addExtraCss([ThemeTypes.CssFile.GUI_COMMANDPALETTE]);
      
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
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.EMPTY_PANE_MENU];
  }
}
