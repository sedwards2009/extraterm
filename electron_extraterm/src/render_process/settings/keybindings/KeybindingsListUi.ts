/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { KeybindingsCategory, EVENT_START_KEY_INPUT, EVENT_END_KEY_INPUT } from './KeybindingsCategoryUi';
import { KeybindingsSet } from '../../../keybindings/KeybindingsTypes';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { Category, ExtensionCommandContribution } from '../../../ExtensionMetadata';


@Component(
  {
    components: {
      "keybindings-category": KeybindingsCategory
    },
    props: {
      baseKeybindingsSet: Object,      // KeybindingsSet,
      customKeybindingsSet: Object,    // KeybindingsSet,
      readOnly: Boolean,
      searchText: String,
      commandsByCategory: Object,
    },
    template: trimBetweenTags(`
    <div>
      <keybindings-category
        v-for="category in categories"
        :key="category"
        :category="category"
        :categoryName="getCategoryName(category)"
        :baseKeybindingsSet="baseKeybindingsSet"
        :customKeybindingsSet="customKeybindingsSet"
        :readOnly="readOnly"
        :searchText="searchText"
        :commands="commandsByCategory[category]"
        v-on:${EVENT_START_KEY_INPUT}="$emit('${EVENT_START_KEY_INPUT}')"
        v-on:${EVENT_END_KEY_INPUT}="$emit('${EVENT_END_KEY_INPUT}')">
      </keybindings-category>
    </div>`)
  }
)
export class KeybindingsList extends Vue {
  // Props
  baseKeybindingsSet: KeybindingsSet;
  customKeybindingsSet: KeybindingsSet;
  commandsByCategory: { [index: string]: ExtensionCommandContribution[] };
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
      "hyperlink",
      "viewer"
    ];
    return categories;
  }

  getCategoryName(category: Category): string {
    return categoryNames[category];
  }
}

const categoryNames = {
  "global": "Global",
  "application": "Application",
  "window": "Window",
  "textEditing": "Text Editor",
  "terminal": "Terminal",
  "terminalCursorMode": "Terminal: Cursor Mode",
  "hyperlink": "Hyperlink",
  "viewer": "Viewer Tabs"
};
