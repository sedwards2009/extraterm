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
import { UiStyle } from "../../ui/UiStyle";


export class StyleImpl implements ExtensionApi.Style {
  #configDatabase: ConfigDatabase;
  #window: Window;
  #palette: ExtensionApi.Palette = null;

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

  createQIcon(name: ExtensionApi.IconName | ExtensionApi.ModifiedIconName, colorRGB?: string): QIcon {
    return this.#window.getUiStyle().getIcon(name, colorRGB === undefined ? this.palette.text : colorRGB);
  }

  get palette(): ExtensionApi.Palette {
    if (this.#palette == null) {
      this.#palette = new PaletteImpl(this.#window.getUiStyle());
    }
    return this.#palette;
  }
}

class PaletteImpl implements ExtensionApi.Palette {
  #uiStyle: UiStyle;

  constructor(uiStyle: UiStyle) {
    this.#uiStyle = uiStyle;
  }
  get text(): string {
    return this.#uiStyle.getTextColor();
  }
  get textHighlight(): string {
    return this.#uiStyle.getTextHighlightColor();
  }
  get background(): string {
    return this.#uiStyle.getBackgroundColor();
  }
  get backgroundSelected(): string {
    return this.#uiStyle.getBackgroundSelectedColor();
  }
  get link(): string {
    return this.#uiStyle.getLinkColor();
  }
  get linkHover(): string {
    return this.#uiStyle.getLinkHoverColor();
  }

}
