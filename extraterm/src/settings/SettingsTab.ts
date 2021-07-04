/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Direction, QBoxLayout, QLineEdit, QWidget } from "@nodegui/nodegui";
import { Tab } from "../Tab";


export class SettingsTab implements Tab {

  #contentWidget: QWidget = null;
  #contentLayout: QBoxLayout = null;

  constructor() {
    this.#contentWidget = new QWidget();
    this.#contentLayout = new QBoxLayout(Direction.TopToBottom, this.#contentWidget);
    const lineEdit = new QLineEdit();
    this.#contentLayout.addWidget(lineEdit);
  }

  getTitle(): string {
    return "Settings";
  }

  getContents(): QWidget {
    return this.#contentWidget;
  }

  focus(): void {
    this.#contentWidget.setFocus();
  }

  unfocus(): void {

  }
}
