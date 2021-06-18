/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, render, TemplateResult } from "extraterm-lit-html";
import { DirectiveFn } from "extraterm-lit-html/lib/directive";
import { Disposable } from "@extraterm/extraterm-extension-api";
import { Attribute, Observe, CustomElement } from "extraterm-web-component-decorators";
import { doLater } from "extraterm-later";
import { log, Logger, getLogger } from "extraterm-logging";

import * as ThemeTypes from "../../theme/Theme";
import { PopDownDialog} from "./PopDownDialog";
import { OnCursorSearchableList } from "./OnCursorSearchableList";
import { ThemeableElementBase } from "../ThemeableElementBase";
import * as DomUtils from "../DomUtils";
import { focusElement } from "../DomUtils";


interface RenderWork {
  updateContents: boolean;
  focusInput: boolean;
}

const MAXIMUM_RESULT_HEIGHT_PERCENT = 0.4;

/**
 * On Cursor List Picker.
 */
@CustomElement("et-on-cursor-list-picker")
export class OnCursorListPicker<T extends { id: string; }> extends ThemeableElementBase {

  static TAG_NAME = "ET-ON-CURSOR-LIST-PICKER";
  static ATTR_DATA_ID = "data-id";
  static CLASS_RESULT_SELECTED = "CLASS_RESULT_SELECTED";
  static CLASS_RESULT_ENTRY = "CLASS_RESULT_ENTRY";

  private _log: Logger = null;
  private _laterHandle: Disposable = null;
  private _extraCssFiles: ThemeTypes.CssFile[] = [];

  private _open = false;
  private _renderWork: RenderWork = null;

  constructor() {
    super();
    this._log = getLogger(OnCursorListPicker.TAG_NAME, this);

    this.attachShadow({ mode: "open", delegatesFocus: true });
    this.updateThemeCss();

    this._handleDialogClose = this._handleDialogClose.bind(this);
    this._handleSelected = this._handleSelected.bind(this);

    this._render();
  }

  private _handleSelected(ev: CustomEvent): void {
    this._okId(ev.detail.selected);
  }

  private _handleDialogClose(): void {
    this._open = false;
    this._scheduleUpdate({ updateContents: true });
    this._okId(null);
  }

  private _scheduleUpdate(renderWork: Partial<RenderWork>): void {
    if (this._renderWork == null) {
      this._renderWork = {
        updateContents: false,
        focusInput: false,
      };

      window.queueMicrotask(() => {
        this._runRenderWork(this._renderWork);
        this._renderWork = null;
      });
    }

    this._renderWork.focusInput = this._renderWork.focusInput || renderWork.focusInput;
    this._renderWork.updateContents = this._renderWork.updateContents || renderWork.updateContents;
  }

  private _runRenderWork(renderWork: RenderWork): void {
    if (renderWork.updateContents) {
      this._render();
    }
    if (renderWork.focusInput) {
      focusElement(this._getSearchableList(), this._log);
    }
  }

  private _render(): void {
    const template = html`${this._styleTag()}
      <et-on-cursor-dialog
          id="ID_DIALOG"
          open=${this._open}
          cursor-left=${this.cursorLeft}
          cursor-top=${this.cursorTop}
          cursor-bottom=${this.cursorBottom}
          @close-request=${this._handleDialogClose}>
        <et-on-cursor-searchable-list
          id="ID_SEARCHABLE_LIST"
          @selected=${this._handleSelected}
        ></et-searchable-list>
      </et-on-cursor-dialog>
      `;

    render(template, this.shadowRoot);
    this.installThemeCss();

    const searchableList = <OnCursorSearchableList<T>> DomUtils.getShadowId(this, "ID_SEARCHABLE_LIST");
    const dialog = <PopDownDialog> DomUtils.getShadowId(this, "ID_DIALOG");
    const dialogRect = dialog.getBoundingClientRect();
    const maxResultsHeight = Math.floor(dialogRect.height * MAXIMUM_RESULT_HEIGHT_PERCENT);
    searchableList.style.setProperty("--results-height", `${maxResultsHeight}px`);

    const reverseOrientation = this.cursorTop > (dialogRect.height / 2);
    searchableList.reverse = reverseOrientation;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    const extraCssFiles = this._extraCssFiles == null? [] : this._extraCssFiles;
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.EXTRAICONS,
      ThemeTypes.CssFile.GUI_ON_CURSOR_LIST_PICKER, ...extraCssFiles];
  }

  @Attribute
  get selected(): string {
    return this._getSearchableList().selected;
  }

  set selected(value: string) {
    this._getSearchableList().selected = value;
  }

  private _getSearchableList(): OnCursorSearchableList<T> {
    const result = <OnCursorSearchableList<T>> this.shadowRoot.getElementById("ID_SEARCHABLE_LIST");
    customElements.upgrade(result);
    return result;
  }

  setEntries(entries: T[]): void {
    this._getSearchableList().setEntries(entries);
  }

  getEntries(): T[] {
    return this._getSearchableList().getEntries();
  }

  @Attribute cursorLeft = 0;
  @Attribute cursorTop = 0;
  @Attribute cursorBottom = 0;

  @Observe("cursorLeft", "cursorTop", "cursorBottom")
  private _observe(target: string): void {
    this._scheduleUpdate({ updateContents: true });
  }

  @Attribute
  get filter(): string {
    return this._getSearchableList().filter;
  }

  set filter(value: string) {
    this._getSearchableList().filter = value;
  }

  setFilterAndRankEntriesFunc(func: (entries: T[], filterText: string) => T[]): void {
    this._getSearchableList().setFilterAndRankEntriesFunc(func);
  }

  setFormatEntriesFunc(func: (filteredEntries: T[], selectedId: string, filter: string) => DirectiveFn | TemplateResult): void {
    this._getSearchableList().setFormatEntriesFunc(func);
  }

  /**
   * Specify extra Css files to load into this element.
   *
   * @param extraCssFiles extra Css files which should be loaded along side the default set.
   */
  addExtraCss(extraCssFiles: ThemeTypes.CssFile[]): void {
    this._getSearchableList().addExtraCss(extraCssFiles);
  }

  open(): void {
    this._open = true;
    this._scheduleUpdate( {focusInput: true, updateContents: true} );
  }

  close(): void {
    this._open = false;
    this._scheduleUpdate( {updateContents: true} );
  }

  isOpen(): boolean {
    return this._open;
  }

  private _okId(selectedId: string): void {
    if (this._laterHandle === null) {
      this._laterHandle = doLater( () => {
        this.close();
        this._laterHandle = null;
        const event = new CustomEvent("selected", { detail: {selected: selectedId } });
        this.dispatchEvent(event);
      });
    }
  }
}
