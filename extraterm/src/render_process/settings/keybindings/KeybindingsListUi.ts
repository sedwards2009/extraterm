/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { KeybindingsCategory, EVENT_START_KEY_INPUT, EVENT_END_KEY_INPUT } from './ContextUi';
import { KeybindingsFile } from '../../../keybindings/KeybindingsFile';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ExtensionManager } from '../../extension/InternalTypes';
import { Category } from '../../../ExtensionMetadata';

const categoryNames = {
  "global": "Global",
  "application": "Application",
  "window": "Window",
  "textEditing": "Text Editor",
  "terminal": "Terminal",
  "terminalCursorMode": "Terminal: Cursor Mode",
  "viewer": "Viewers"
};


@Component(
  {
    components: {
      "keybindings-category": KeybindingsCategory
    },
    props: {
      extensionManager: Object, // ExtensionManager;
      keybindings: Object,      // KeybindingsFile,
      readOnly: Boolean,
      searchText: String
    },
    template: trimBetweenTags(`
    <div>
      <keybindings-category
        v-for="category in categories"
        :key="category"
        :category="category"
        :categoryName="getCategoryName(category)"
        :keybindings="keybindings"
        :readOnly="readOnly"
        :searchText="searchText"
        :extensionManager="extensionManager"
        v-on:${EVENT_START_KEY_INPUT}="$emit('${EVENT_START_KEY_INPUT}')"
        v-on:${EVENT_END_KEY_INPUT}="$emit('${EVENT_END_KEY_INPUT}')">
      </keybindings-category>
    </div>`)
  }
)
export class KeybindingsList extends Vue {
  // Props
  keybindings: KeybindingsFile;
  extensionManager: ExtensionManager;
  readOnly: boolean;
  searchText: string;

  get categories(): Category[] {
    const categories: Category[] = [
      "global",
      "application",
      "window",
      "textEditing",
      "terminal",
      "terminalCursorMode",
      "viewer"
    ];
    return categories;
  }

  getCategoryName(category: Category): string {
    return categoryNames[category];
  }
}
