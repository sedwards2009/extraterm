/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { getLogger, log, Logger } from "extraterm-logging";

import { Direction, QBoxLayout, QScrollArea, QWidget, SizeConstraint } from "@nodegui/nodegui";
import { Tab } from "../Tab";
import { Block } from "./Block";
import { TerminalBlock } from "./TerminalBlock";


export class Terminal implements Tab {
  private _log: Logger = null;

  #scrollArea: QScrollArea = null;
  #blocks: Block[] = [];
  #contentLayout: QBoxLayout = null;

  constructor() {
    this._log = getLogger("Terminal", this);

    this.#scrollArea = new QScrollArea();
    this.#scrollArea.setWidgetResizable(true);
    const contentWidget = new QWidget();
    contentWidget.setObjectName("content");
    contentWidget.setStyleSheet(`
    #content {
      background-color: #00ff00;
    }
    `);
    this.#contentLayout = new QBoxLayout(Direction.TopToBottom, contentWidget);
    this.#contentLayout.setSizeConstraint(SizeConstraint.SetMinimumSize);
    this.#scrollArea.setWidget(contentWidget);
    this.#contentLayout.addStretch(1);

    this.appendBlock(new TerminalBlock());
  }

  appendBlock(block: Block): void {
    this.#blocks.push(block);
    const geo = block.getWidget().geometry();
    this.#contentLayout.insertWidget(this.#blocks.length-1, block.getWidget());
  }

  getTitle(): string {
    return "Terminal";
  }

  getContents(): QWidget {
    return this.#scrollArea;
  }
}
