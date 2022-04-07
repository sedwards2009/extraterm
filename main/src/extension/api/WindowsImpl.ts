/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../../InternalTypes.js";

export class WindowsImpl implements ExtensionApi.Windows {

  #internalExtensionContext: InternalExtensionContext;

  constructor(internalExtensionContext: InternalExtensionContext) {
    this.#internalExtensionContext = internalExtensionContext;
  }

  registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    this.#internalExtensionContext.tabTitleWidgetRegistry.registerTabTitleWidget(name, factory);
  }

  registerTerminalThemeProvider(name: string, provider: ExtensionApi.TerminalThemeProvider): void {
    this.#internalExtensionContext.registerTerminalThemeProvider(name, provider);
  }
}
