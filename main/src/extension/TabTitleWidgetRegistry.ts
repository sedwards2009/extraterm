/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { Logger, getLogger } from "extraterm-logging";

import { ExtensionMetadata, ExtensionTabTitlesWidgetContribution } from './ExtensionMetadata.js';
import { QLabel, TextFormat, TextInteractionFlag } from '@nodegui/nodegui';


export class TabTitleWidgetRegistry {
  private _log: Logger = null;
  #registeredTabTitleWidgetFactories: Map<string, ExtensionApi.TabTitleWidgetFactory> = null;
  #extensionMetadata: ExtensionMetadata;

  constructor(extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("TabTitleWidgetRegistry", this);
    this.#extensionMetadata = extensionMetadata;
    this.#registeredTabTitleWidgetFactories = new Map();
  }

  registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    let tabTitleWidgetMetadata: ExtensionTabTitlesWidgetContribution = null;
    for (const ttwmd of this.#extensionMetadata.contributes.tabTitleWidgets) {
      if (ttwmd.name === name) {
        tabTitleWidgetMetadata = ttwmd;
        break;
      }
    }

    if (tabTitleWidgetMetadata == null) {
      this._log.warn(`Unable to register tab title widget '${name}' for extension ` +
        `'${this.#extensionMetadata.name}' because the tab title widget contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    this.#registeredTabTitleWidgetFactories.set(tabTitleWidgetMetadata.name, factory);
  }

  createTabTitleWidgets(terminal: ExtensionApi.Terminal): QLabel[] {
    const widgets: QLabel[] = [];
    for (const factory of this.#registeredTabTitleWidgetFactories.values()) {
      const label = factory(terminal);
      label.setTextInteractionFlags(TextInteractionFlag.NoTextInteraction);
      // ^ Don't allow any interaction for labels inside tabs. It breaks drag and drop of tabs.

      widgets.push(label);
    }
    return widgets;
  }
}
