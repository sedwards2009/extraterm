/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { createHtmlIcon } from "../../ui/Icons";
import { ConfigDatabase } from "../../config/ConfigDatabase";
import { Window } from "../../Window";
import { QIcon } from "@nodegui/nodegui";


export class StyleImpl implements ExtensionApi.Style {
  #configDatabase: ConfigDatabase;
  #window: Window;

  constructor(configDatabase: ConfigDatabase, window: Window) {
    this.#configDatabase = configDatabase;
    this.#window = window;
  }

  get dpi(): number {
    return this.#window.getDpi();
  }

  get htmlStyleTag(): string {
    return this.#window.getUiStyle().getHTMLStyleTag();
  }

  emToPx(em: number): number {
    const dpi = this.#window.getDpi();
    const generalConfig = this.#configDatabase.getGeneralConfig();
    return Math.round(em * 9 * (generalConfig.uiScalePercent / 100) * dpi / 72);
  }

  createHtmlIcon(name: ExtensionApi.IconName): string {
    return createHtmlIcon(name);
  }

  createQIcon(name: ExtensionApi.IconName | ExtensionApi.ModifiedIconName): QIcon {
    return this.#window.getUiStyle().getButtonIcon(name);
  }
}
