/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { ConfigDatabase } from "../../config/ConfigDatabase";
import { Window } from "../../Window";


export class StyleImpl implements ExtensionApi.Style {

  #window: Window;
  #configDatabase: ConfigDatabase;

  constructor(window: Window, configDatabase: ConfigDatabase) {
    this.#configDatabase = configDatabase;
    this.#window = window;
  }

  get dpi(): number {
    return this.#window.getDpi();
  }

  get htmlStyleTag(): string {
    return this.#window.getHtmlStyleTag();
  }

  emToPx(em: number): number {
    const dpi = this.#window.getDpi();
    const generalConfig = this.#configDatabase.getGeneralConfig();
    return Math.round(em * 9 * (generalConfig.uiScalePercent / 100) * dpi / 72);
  }
}
