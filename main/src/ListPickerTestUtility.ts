/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QApplication, QMainWindow, QWidget } from "@nodegui/nodegui";
import * as path from "node:path";
import * as SourceDir from './SourceDir';

import { createUiStyle } from "./ui/styles/DarkTwo.js";
import { FieldType, ListPicker } from "./ui/ListPicker.js";

let centralWidget: QWidget = null;

function main(): void {

  const win = new QMainWindow();
  win.setWindowTitle("List Picker Test");

  const uiStyle = createUiStyle(path.join(SourceDir.posixPath, "../resources/theme_ui/DarkTwo/"), "native");

  const styleSheet = uiStyle.getApplicationStyleSheet(1, QApplication.primaryScreen().logicalDotsPerInch());
  const listPicker = new ListPicker(uiStyle);

  listPicker.setEntries([FieldType.ICON_NAME, FieldType.TEXT, FieldType.SECONDARY_TEXT_RIGHT],
    [
      {id: "Apple", searchText: "Apple", fields: ["fa-fish", "Apple", "Fruit"]},
      {id: "Banana", searchText: "Banana", fields: ["", "Banana", "Fruit"]},
      {id: "Blueberry", searchText: "Blueberry", fields: ["", "Blueberry", "Fruit"]},
      {id: "Cabbage", searchText: "Cabbage", fields: ["", "Cabbage", "Vegetable"]},
      {id: "Coconut", searchText: "Coconut", fields: ["", "Coconut", "Fruit"]},
      {id: "Date", searchText: "Date", fields: ["", "Date", "Fruit"]},
      {id: "Elderberry", searchText: "Elderberry", fields: ["", "Elderberry", "Fruit"]},
      {id: "Fig", searchText: "Fig", fields: ["", "Fig", "Fruit"]},
      {id: "Grape", searchText: "Grape", fields: ["", "Grape", "Fruit"]},
      {id: "Hackberry", searchText: "Hackberry", fields: ["", "Hackberry", "Fruit"]},
      {id: "Horseradish", searchText: "Horseradish", fields: ["", "Horseradish", "Vegetable"]},
      {id: "Iyokan", searchText: "Iyokan", fields: ["", "Iyokan", "Fruit"]},
      {id: "Jackfruit", searchText: "Jackfruit", fields: ["", "Jackfruit", "Fruit"]},
      {id: "Kiwi", searchText: "Kiwi", fields: ["", "Kiwi", "Fruit"]},
      {id: "Leek", searchText: "Leek", fields: ["", "Leek", "Vegetable"]},
      {id: "Mustard", searchText: "Mustard", fields: ["", "Mustard", "Fruit"]},
      {id: "Nutmeg", searchText: "Nutmeg", fields: ["", "Nutmeg", "Fruit"]},
      {id: "Orange", searchText: "Orange", fields: ["", "Orange", "Fruit"]},
      {id: "Pear", searchText: "Pear", fields: ["", "Pear", "Fruit"]},
      {id: "Prune", searchText: "Prune", fields: ["", "Prune", "Fruit"]},
      {id: "Quince", searchText: "Quince", fields: ["", "Quince", "Fruit"]},
      {id: "Raspberry", searchText: "Raspberry", fields: ["", "Raspberry", "Fruit"]},
      {id: "Strawberry", searchText: "Strawberry", fields: ["", "Strawberry", "Fruit"]},
      {id: "Tangerine", searchText: "Tangerine", fields: ["", "Tangerine", "Fruit"]},
      {id: "Watermelon", searchText: "Watermelon", fields: ["", "Watermelon", "Fruit"]},
    ]
  );

  centralWidget = listPicker.getWidget();

  // console.log(styleSheet);

  win.resize(600, 800);
  centralWidget.setStyleSheet(styleSheet, false);

  win.setCentralWidget(centralWidget);
  win.show();

  (global as any).win = win;
}

main();
