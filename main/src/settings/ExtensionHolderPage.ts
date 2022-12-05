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

import { ConfigDatabase } from "../config/ConfigDatabase.js";
import { LoadedSettingsTabContribution } from "../extension/SettingsTabRegistry.js";
import { createHtmlIcon } from "../ui/Icons.js";
import { SettingsPageType } from "./SettingsPageType.js";
import { UiStyle } from "../ui/UiStyle.js";
import { StyleImpl } from "../extension/api/StyleImpl.js";
import { Window } from "../Window.js";


export class ExtensionHolderPage implements SettingsPageType {

  #contribution: LoadedSettingsTabContribution = null;
  #configDatabase: ConfigDatabase = null;
  #window: Window = null;
  uiStyle: UiStyle = null;
  #page: QScrollArea = null;
  #containerLayout: QBoxLayout = null;
  #extensionWidget: QWidget = null;

  constructor(contribution: LoadedSettingsTabContribution, configDatabase: ConfigDatabase, window: Window,
      uiStyle: UiStyle) {

    this.#contribution = contribution;
    this.#configDatabase = configDatabase;
    this.#window = window;
    this.uiStyle = uiStyle;
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
    const settingsTab = new SettingsTabImpl(this, this.#configDatabase, this.#window);
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
  #style: ExtensionApi.Style = null;

  constructor(holderPage: ExtensionHolderPage, configDatabase: ConfigDatabase, window: Window) {
    this.#holderPage = holderPage;
    this.#style = new StyleImpl(configDatabase, window);
  }

  set contentWidget(contentWidget: QWidget) {
    this.#holderPage.setContentWidget(contentWidget);
  }

  get style(): ExtensionApi.Style {
    return this.#style;
  }
}
