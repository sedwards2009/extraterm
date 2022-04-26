/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Logger, log, getLogger } from "extraterm-logging";
import { QAbstractTableModel, Direction, QWidget, QVariant, QKeyEvent, QModelIndex, ItemDataRole, QTableView,
  QAbstractItemViewSelectionBehavior, SelectionMode, QLineEdit, Key, SelectionFlag, FocusReason, ItemFlag, AlignmentFlag
} from "@nodegui/nodegui";
import * as fuzzyjs from "fuzzyjs";
import { BoxLayout, TableView, Widget, LineEdit } from "qt-construct";
import { UiStyle } from "./UiStyle.js";


export enum FieldType {
  TEXT,
  SECONDARY_TEXT,
  SECONDARY_TEXT_RIGHT,
  ICON_NAME
}

export interface Entry {
  id: string;
  searchText: string;

  fields: string[];
}


export class ListPicker {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #widget: QWidget = null;
  #lineEdit: QLineEdit = null;
  #tableView: QTableView = null;
  #contentModel: ContentModel = null;

  #selectedEventEmitter = new EventEmitter<string>();
  onSelected: Event<string> = null;

  constructor(uiStyle: UiStyle) {
    this._log = getLogger("ListPicker", this);
    this.#uiStyle = uiStyle;
    this.onSelected = this.#selectedEventEmitter.event;
    this.#createWidget();
  }

  setEntries(fieldTypes: FieldType[], entries: Entry[]): void {
    this.#contentModel.setEntries(fieldTypes, entries);
    this.#handleTextEdited("");
    this.#tableView.resizeColumnsToContents();
  }

  #createWidget(): void {
    this.#contentModel = new ContentModel(this.#uiStyle);
    this.#widget = Widget({
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: [0, 0, 0, 0],
        children: [
          this.#lineEdit = LineEdit({
            onTextEdited: (newText: string) => {
              this.#handleTextEdited(newText);
            },
            onKeyPress: (nativeEvent) => {
              this.#handleKeyPress(new QKeyEvent(nativeEvent));
            },
          }),
          this.#tableView = TableView({
            cssClass: ["list-picker"],
            model: this.#contentModel,
            showGrid: false,
            selectionBehavior: QAbstractItemViewSelectionBehavior.SelectRows,
            selectionMode: SelectionMode.SingleSelection,
            cornerButtonEnabled: false,
            onClicked: (nativeElement) => {
              this.#handleClicked(new QModelIndex(nativeElement));
            }
          })
        ]
      })
    });

    const horizontalHeader = this.#tableView.horizontalHeader();
    horizontalHeader.hide();
    horizontalHeader.setStretchLastSection(true);
    const verticalHeader = this.#tableView.verticalHeader();
    verticalHeader.hide();

    this.#tableView.selectionModel().select(this.#contentModel.createIndex(0, 0),
      SelectionFlag.ClearAndSelect | SelectionFlag.Rows);
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  focus(): void {
    this.#lineEdit.setFocus(FocusReason.PopupFocusReason);
  }

  setText(text: string): void {
    this.#lineEdit.setText(text);
  }

  #handleTextEdited(newText: string): void {
    this.#contentModel.setSearch(newText);
    this.#tableView.selectionModel().select(this.#contentModel.createIndex(0, 0),
      SelectionFlag.ClearAndSelect | SelectionFlag.Rows);
  }

  #handleClicked(index: QModelIndex): void {
    this.#selectedEventEmitter.fire(this.#contentModel.idByRow(index.row()));
  }

  #handleKeyPress(event: QKeyEvent): void {
    const key = event.key();
    if ( ! [Key.Key_Down, Key.Key_Up, Key.Key_PageUp, Key.Key_PageDown, Key.Key_Tab, Key.Key_Enter, Key.Key_Return].includes(key)) {
      return;
    }

    if (key === Key.Key_Tab) {
      // Block the tab key
      event.accept();
      this.#lineEdit.setEventProcessed(true);
      return;
    }

    if (this.#contentModel.rowCount() === 0) {
      return;
    }

    if (key === Key.Key_Enter || key === Key.Key_Return) {
      event.accept();
      this.#lineEdit.setEventProcessed(true);
      this.#handleEnterPressed();
      return;
    }

    const selectionModel = this.#tableView.selectionModel();
    const rowIndexes = selectionModel.selectedRows();
    let selectedRowIndex = rowIndexes[0].row();

    if (key === Key.Key_Down) {
      selectedRowIndex++;
    } else if (key === Key.Key_Up) {
      selectedRowIndex--;
    } else if (key === Key.Key_PageUp || key === Key.Key_PageDown) {
      const rowsPerViewport = Math.floor(this.#tableView.height() / this.#tableView.rowHeight(0));
      selectedRowIndex += (key === Key.Key_PageUp ? -1 : 1) * rowsPerViewport;
    } else {
      return;
    }

    selectedRowIndex = Math.max(0, selectedRowIndex);
    selectedRowIndex = Math.min(selectedRowIndex, this.#contentModel.rowCount()-1);
    const newIndex = this.#contentModel.createIndex(selectedRowIndex, 0);
    selectionModel.select(newIndex, SelectionFlag.ClearAndSelect | SelectionFlag.Rows);
    this.#tableView.scrollTo(newIndex);

    event.accept();
    this.#lineEdit.setEventProcessed(true);
  }

  #handleEnterPressed(): void {
    const selectionModel = this.#tableView.selectionModel();
    const rowIndexes = selectionModel.selectedRows();
    const selectedRowIndex = rowIndexes[0].row();
    this.#selectedEventEmitter.fire(this.#contentModel.idByRow(selectedRowIndex));
  }
}


interface EntryMetadata {
  entry: Entry;

  text: string;
  markedupText: string;
  score: number;
}


function cmpScore(a: EntryMetadata, b: EntryMetadata): number {
  if (a.score === b.score) {
    return 0;
  }
  return a.score < b.score ? -1 : 1;
}


class ContentModel extends QAbstractTableModel {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #allEntries: EntryMetadata[] = [];
  #fieldTypes: FieldType[] = [];
  #visibleEntries: EntryMetadata[] = [];
  #searchText: string = "";

  constructor(uiStyle: UiStyle) {
    super();
    this._log = getLogger("ContentModel", this);
    this.#uiStyle = uiStyle;
  }

  setSearch(searchText: string): void {
    this.#searchText = searchText;
    this.#updateVisibleEntries();
  }

  #updateVisibleEntries(): void {
    this.beginResetModel();
    this.#visibleEntries = this.#filterEntries(this.#allEntries, this.#searchText);
    this.endResetModel();
  }

  #filterEntries(entries: EntryMetadata[], searchText: string): EntryMetadata[] {
    if (searchText.trim() === "") {
      let i = 0;
      for (const entry of entries) {
        entry.score = i;
        entry.markedupText = entry.text;
        i++;
      }
      return [...entries];

    } else {
      for (const entry of entries) {
        const result = fuzzyjs.match(searchText, entry.text, { withRanges: true });
        if (result.match) {
          entry.score = result.score;
          // const ranges = result.ranges;
          // entry.markedupLabel = fuzzyjs.surround(entry.title,
          //   {
          //     result: {
          //       ranges
          //     },
          //     prefix: SELECTION_START_MARKER,
          //     suffix: SELECTION_END_MARKER
          //   }
          // );
        } else {
          entry.score = -1;
          // entry.markedupLabel = entry;
        }
      }

      const resultEntries = entries.filter(e => e.score !== -1);
      resultEntries.sort(cmpScore);
      return resultEntries;
    }
  }

  setEntries(fieldTypes: FieldType[], entries: Entry[]): void {
    if (entries.length === 0) {
      this.#allEntries = [];
      return;
    }

    const textFieldIndex = fieldTypes.indexOf(FieldType.TEXT);
    if (textFieldIndex === -1) {
      this._log.warn("Argument `fieldTypes` to `setEntries()` must contain a `FieldType.TEXT` value");
      return;
    }

    this.#fieldTypes = fieldTypes;
    this.#allEntries = entries.map(entry => ({
      entry: entry,
      text: entry.fields[textFieldIndex],
      markedupText: entry.fields[textFieldIndex],
      score: 0,
    }));
    this.#updateVisibleEntries();
  }

  rowCount(parent = new QModelIndex()): number {
    return this.#visibleEntries.length;
  }

  columnCount(parent = new QModelIndex()): number {
    return this.#fieldTypes.length;
  }

  data(index: QModelIndex, role = ItemDataRole.DisplayRole): QVariant {
    if (role === ItemDataRole.DisplayRole) {
      const column = index.column();
      switch (this.#fieldTypes[column]) {
        case FieldType.TEXT:
          return new QVariant(this.#visibleEntries[index.row()].text);
        case FieldType.SECONDARY_TEXT:
        case FieldType.SECONDARY_TEXT_RIGHT:
          return new QVariant(this.#visibleEntries[index.row()].entry.fields[column]);
      }
    }
    if (role === ItemDataRole.TextAlignmentRole) {
      if (this.#fieldTypes[index.column()] === FieldType.SECONDARY_TEXT_RIGHT) {
        return new QVariant(AlignmentFlag.AlignRight | AlignmentFlag.AlignVCenter);
      }
    }
    if (role === ItemDataRole.DecorationRole) {
      if (this.#fieldTypes[index.column()] === FieldType.ICON_NAME) {
        const column = index.column();
        const iconName = this.#visibleEntries[index.row()].entry.fields[column];
        if (iconName != null && iconName !== "") {
          const icon = this.#uiStyle.getCommandPaletteIcon(iconName);
          if (icon != null) {
            return new QVariant(icon.native);
          }
        }
      }
    }
    return new QVariant();
  }

  idByRow(row: number): string {
    return this.#visibleEntries[row].entry.id;
  }
}
