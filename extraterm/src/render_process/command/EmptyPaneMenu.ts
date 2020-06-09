/*
 * Copyright 2019-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { CustomElement } from "extraterm-web-component-decorators";
import { html, render } from "extraterm-lit-html";

import * as ThemeTypes from "../../theme/Theme";
import {ThemeableElementBase} from "../ThemeableElementBase";
import {ListPicker} from "../gui/ListPicker";
import * as DomUtils from "../DomUtils";
import {commandPaletteFilterEntries, commandPaletteFormatEntries, CommandAndShortcut } from "./CommandPalette";
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";

const ID_LIST_PICKER = "ID_LIST_PICKER";


/**
 * The Extraterm Empty Pane Menu.
 */
@CustomElement("et-empty-pane-menu")
export class EmptyPaneMenu extends ThemeableElementBase {

  static TAG_NAME = "ET-EMPTY-PANE-MENU";

  private _log: Logger;
  private _entries: CommandAndShortcut[] = [];

  constructor() {
    super();
    this._log = getLogger(EmptyPaneMenu.TAG_NAME, this);

    this.attachShadow({ mode: "open", delegatesFocus: false });

    this._handleListPickerSelected = this._handleListPickerSelected.bind(this);
    this._handleCloseClicked = this._handleCloseClicked.bind(this);

    this._render();
    this.updateThemeCss();

    const listPicker = <ListPicker<CommandAndShortcut>> DomUtils.getShadowId(this, ID_LIST_PICKER);
    listPicker.setFilterAndRankEntriesFunc(commandPaletteFilterEntries);
    listPicker.setFormatEntriesFunc(commandPaletteFormatEntries);
    listPicker.addExtraCss([ThemeTypes.CssFile.COMMAND_PALETTE]);
    listPicker.setEntries(this._entries);
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <div id="ID_EMPTY_PANE_MENU">
        <div id="ID_CONTAINER">
          <div id="ID_TITLE" class="gui-packed-row">
            <span class="expand">Pane Menu</span>
            <button
              id="ID_CLOSE_BUTTON"
              class="compact microtool danger"
              @click=${this._handleCloseClicked}
            >
              <i class="fa fa-times"></i>
            </button>
          </div>
          <et-list-picker
            id="${ID_LIST_PICKER}"
            @selected=${this._handleListPickerSelected}
          ></et-list-picker>
        </div>
      </div>`;
    render(template, this.shadowRoot);
  }

  private _handleListPickerSelected(ev: CustomEvent): void {
    this._emitSelectedEvent(ev.detail.selected);
  }

  private _handleCloseClicked(): void {
    this._emitSelectedEvent("extraterm:window.closePane_window");
  }

  private _emitSelectedEvent(command: string): void {
    const event = new CustomEvent("selected", { detail: {selected: command } });
    this.dispatchEvent(event);
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

  setEntries(entries: CommandAndShortcut[]): void {
    this._entries = entries;

    if (DomUtils.getShadowRoot(this) != null) {
      const listPicker = <ListPicker<CommandAndShortcut>> DomUtils.getShadowId(this, ID_LIST_PICKER);
      listPicker.setEntries(entries);
    }
  }

  getEntries(): CommandAndShortcut[] {
    return this._entries;
  }

  getFilter(): string {
    const listPicker = <ListPicker<CommandAndShortcut>> DomUtils.getShadowId(this, ID_LIST_PICKER);
    return listPicker.filter;
  }

  setFilter(text: string): void {
    const listPicker = <ListPicker<CommandAndShortcut>> DomUtils.getShadowId(this, ID_LIST_PICKER);
    listPicker.filter = text;
  }
}
