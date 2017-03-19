/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as he from 'he';
import * as CommandPaletteTypes from './gui/CommandPaletteTypes';
import {PopDownListPicker} from './gui/PopDownListPicker';

const CLASS_RESULT_GROUP_HEAD = "CLASS_RESULT_GROUP_HEAD";
const CLASS_RESULT_ICON_LEFT = "CLASS_RESULT_ICON_LEFT";
const CLASS_RESULT_ICON_RIGHT = "CLASS_RESULT_ICON_RIGHT";
const CLASS_RESULT_LABEL = "CLASS_RESULT_LABEL";
const CLASS_RESULT_SHORTCUT = "CLASS_RESULT_SHORTCUT";

export function commandPaletteFilterEntries(entries: CommandPaletteTypes.CommandEntry[], filter: string): CommandPaletteTypes.CommandEntry[] {
  const lowerFilter = filter.toLowerCase();
  return entries.filter( (entry) => entry.label.toLowerCase().includes(lowerFilter) );
}

export function commandPaletteFormatEntries(entries: CommandPaletteTypes.CommandEntry[], selectedId: string, filterInputValue: string): string {
    return (filterInputValue.trim() === "" ? commandPaletteFormatEntriesWithGroups : commandPaletteFormatEntriesAsList)(entries, this._selectedId);
}

function commandPaletteFormatEntriesAsList(entries: CommandPaletteTypes.CommandEntry[], selectedId: string): string {
  return entries.map( (entry) => commandPaletteFormatEntry(entry, entry.id === selectedId) ).join("");
}

function commandPaletteFormatEntriesWithGroups(entries: CommandPaletteTypes.CommandEntry[], selectedId: string): string {
  let currentGroup: string = null;
  const htmlParts: string[] = [];

  for (let entry of entries) {
    let extraClass = "";
    if (entry.group !== currentGroup && currentGroup !== null) {
      extraClass = CLASS_RESULT_GROUP_HEAD;
    }
    currentGroup = entry.group;
    htmlParts.push(commandPaletteFormatEntry(entry, entry.id === selectedId, extraClass));
  }
  
  return htmlParts.join("");
}

function commandPaletteFormatEntry(entry: CommandPaletteTypes.CommandEntry, selected: boolean, extraClassString = ""): string {
  return `<div class='${PopDownListPicker.CLASS_RESULT_ENTRY} ${selected ? PopDownListPicker.CLASS_RESULT_SELECTED : ""} ${extraClassString}' ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>
    <div class='${CLASS_RESULT_ICON_LEFT}'>${commandPaletteFormatIcon(entry.iconLeft)}</div>
    <div class='${CLASS_RESULT_ICON_RIGHT}'>${commandPaletteFormatIcon(entry.iconRight)}</div>
    <div class='${CLASS_RESULT_LABEL}'>${he.encode(entry.label)}</div>
    <div class='${CLASS_RESULT_SHORTCUT}'>${entry.shortcut !== undefined && entry.shortcut !== null ? he.encode(entry.shortcut) : ""}</div>
  </div>`;
}

function commandPaletteFormatIcon(iconName?: string): string {
  return `<i class='fa fa-fw ${iconName !== undefined && iconName !== null ? "fa-" + iconName : ""}'></i>`;
}
