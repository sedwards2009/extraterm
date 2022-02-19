/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../../InternalTypes";

export class WindowsImpl implements ExtensionApi.Windows {

  #internalExtensionContext: InternalExtensionContext;

  constructor(internalExtensionContext: InternalExtensionContext) {
    this.#internalExtensionContext = internalExtensionContext;
  }

  registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    throw new Error("Method not implemented.");
  }

  registerTerminalBorderWidget(name: string, factory: ExtensionApi.TerminalBorderWidgetFactory): void {
    throw new Error("Method not implemented.");
  }

  registerTerminalThemeProvider(name: string, provider: ExtensionApi.TerminalThemeProvider): void {
    this.#internalExtensionContext.registerTerminalThemeProvider(name, provider);
  }
}
