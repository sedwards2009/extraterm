/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { Direction, QMainWindow, QWidget } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, Label, LineEdit, PushButton, RadioButton, ScrollArea, SpinBox, TabWidget,
  Widget } from "qt-construct";
import * as fs from "fs";
import * as path from "path";
import * as SourceDir from './SourceDir';

import { createUiStyle } from "./ui/styles/DarkTwo";
import { FieldType, ListPicker } from "./ui/ListPicker";

let centralWidget: QWidget = null;

function main(): void {

  const win = new QMainWindow();
  win.setWindowTitle("List Picker Test");
  const listPicker = new ListPicker();

  listPicker.setEntries([FieldType.TEXT],
    [
      {id: "Apple", searchText: "Apple", fields: ["Apple"]},
      {id: "Banana", searchText: "Banana", fields: ["Banana"]},
      {id: "Blueberry", searchText: "Blueberry", fields: ["Blueberry"]},
      {id: "Cabbage", searchText: "Cabbage", fields: ["Cabbage"]},
      {id: "Coconut", searchText: "Coconut", fields: ["Coconut"]},
      {id: "Date", searchText: "Date", fields: ["Date"]},
      {id: "Elderberry", searchText: "Elderberry", fields: ["Elderberry"]},
      {id: "Fig", searchText: "Fig", fields: ["Fig"]},
      {id: "Grape", searchText: "Grape", fields: ["Grape"]},
      {id: "Hackberry", searchText: "Hackberry", fields: ["Hackberry"]},
      {id: "Horseradish", searchText: "Horseradish", fields: ["Horseradish"]},
      {id: "Iyokan", searchText: "Iyokan", fields: ["Iyokan"]},
      {id: "Jackfruit", searchText: "Jackfruit", fields: ["Jackfruit"]},
      {id: "Kiwi", searchText: "Kiwi", fields: ["Kiwi"]},
      {id: "Leek", searchText: "Leek", fields: ["Leek"]},
      {id: "Mustard", searchText: "Mustard", fields: ["Mustard"]},
      {id: "Nutmeg", searchText: "Nutmeg", fields: ["Nutmeg"]},
      {id: "Orange", searchText: "Orange", fields: ["Orange"]},
      {id: "Pear", searchText: "Pear", fields: ["Pear"]},
      {id: "Prune", searchText: "Prune", fields: ["Prune"]},
      {id: "Quince", searchText: "Quince", fields: ["Quince"]},
      {id: "Raspberry", searchText: "Raspberry", fields: ["Raspberry"]},
      {id: "Strawberry", searchText: "Strawberry", fields: ["Strawberry"]},
      {id: "Tangerine", searchText: "Tangerine", fields: ["Tangerine"]},
      {id: "Watermelon", searchText: "Watermelon", fields: ["Watermelon"]},
    ]
  );

  centralWidget = listPicker.getWidget();

  const styleSheet = createUiStyle(path.join(SourceDir.posixPath, "../resources/theme_ui/DarkTwo/"))
                      .getApplicationStyleSheet();
  // console.log(styleSheet);

  win.resize(600, 800);
  centralWidget.setStyleSheet(styleSheet);

  win.setCentralWidget(centralWidget);
  win.show();

  (global as any).win = win;
}

main();
