/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {
  Direction,
  QBoxLayout,
  QScrollArea,
  QWidget,
  TextFormat
} from "@nodegui/nodegui";
import { BoxLayout, Label, ScrollArea, Widget } from "qt-construct";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { LoadedSettingsTabContribution } from "../extension/SettingsTabRegistry.js";
import { createHtmlIcon } from "../ui/Icons.js";
import { SettingsPageType } from "./SettingsPageType.js";
import { UiStyle } from "../ui/UiStyle.js";


export class ExtensionHolderPage implements SettingsPageType {

  #contribution: LoadedSettingsTabContribution;
  #uiStyle: UiStyle = null;
  #page: QScrollArea = null;
  #containerLayout: QBoxLayout = null;
  #extensionWidget: QWidget = null;

  constructor(contribution: LoadedSettingsTabContribution, uiStyle: UiStyle) {
    this.#contribution = contribution;
    this.#uiStyle = uiStyle;
  }

  getIconName(): string {
    return this.#contribution.metadata.icon;
  }

  getMenuText(): string {
    return this.#contribution.metadata.title;
  }

  getName(): string {
    const extensionName = this.#contribution.internalExtensionContext.extensionMetadata.name;
console.log(`${extensionName}:${this.#contribution.metadata.name}`);
    return `${extensionName}:${this.#contribution.metadata.name}`;
  }

  getPage(): QWidget {
    if (this.#page != null) {
      return this.#page;
    }

    this.#page = ScrollArea({
      cssClass: "settings-tab",
      widgetResizable: true,
      widget: Widget({
        contentsMargins: 0,
        cssClass: "background",
        layout: this.#containerLayout = BoxLayout({
          direction: Direction.TopToBottom,
          spacing: 0,
          children: [
            Label({
              text: `${createHtmlIcon(this.getIconName())}&nbsp;&nbsp;${this.getMenuText()}`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]
            }),
            {
              widget: Widget({}),
              stretch: 1
            }
          ]
        })
      })
    });
    const settingsTab = new SettingsTabImpl(this);
    this.#contribution.factory(settingsTab);

    return this.#page;
  }

  setContentWidget(contentWidget: QWidget): void {
    if (this.#extensionWidget != null) {
      this.#extensionWidget.setParent(null);
    }
    this.#containerLayout.insertWidget(1, contentWidget);
    this.#extensionWidget = contentWidget;
  }
}

export class SettingsTabImpl implements ExtensionApi.SettingsTab {

  #holderPage: ExtensionHolderPage;

  constructor(holderPage: ExtensionHolderPage) {
    this.#holderPage = holderPage;
  }

  set contentWidget(contentWidget: QWidget) {
    this.#holderPage.setContentWidget(contentWidget);
  }
}
