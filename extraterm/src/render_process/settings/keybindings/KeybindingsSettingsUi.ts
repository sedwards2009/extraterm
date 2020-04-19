/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';

import { trimBetweenTags} from 'extraterm-trim-between-tags';
import { KeybindingsSet, LogicalKeybindingsName } from '../../../keybindings/KeybindingsTypes';
import { EVENT_START_KEY_INPUT, EVENT_END_KEY_INPUT } from './KeybindingsCategoryUi';
import { KeybindingsList } from './KeybindingsListUi';
import { KeybindingsKeyInput, EVENT_SELECTED, EVENT_CANCELED } from './KeyInputUi';
import { TermKeyStroke } from '../../keybindings/KeyBindingsManager';
import { ExtensionCommandContribution } from '../../../ExtensionMetadata';

interface KeybindingsInfo {
  id: LogicalKeybindingsName;
  name: string;
}

const allKeybindingFiles: KeybindingsInfo[] = [
  {
    id: "pc-style",
    name: "PC style bindings"
  },
  {
    id: "pc-style-emacs",
    name: "PC style with emacs bindings"
  },
  {
    id: "macos-style",
    name: "MacOS style bindings",
  },
  {
    id: "macos-style-emacs",
    name: "MacOS style with emacs bindings",
  },
];


@Component(
  {
    components: {
      "keybindings-category-list": KeybindingsList,
      "keybindings-key-input": KeybindingsKeyInput,
    },
    template: trimBetweenTags(`
<div class="settings-page">
  <h2 class="no-user-select"><i class="far fa-keyboard"></i>&nbsp;&nbsp;Keybindings</h2>

  <div class="gui-packed-row">
    <label>Keybindings:</label>

    <select
        class="expand"
        id="keybindings-style"
        v-model="selectedKeybindings">
      <option v-for="option in sortedKeybindingsInfoList" v-bind:value="option.name">
        {{ option.name }}
      </option>
    </select>
  </div>

  <div class="gui-packed-row">
    <input v-if="! recordingKey"
      v-model="searchText"
      class="expand"
      placeholder="Filter commands by name"
      />

    <keybindings-key-input v-else
      class="expand"
      v-on:${EVENT_SELECTED}="onKeyInputSelected"
      v-on:${EVENT_CANCELED}="onKeyInputCancelled">
    </keybindings-key-input>

    <button
        title="Record key"
        v-bind:class="{'inline': true, 'selected': recordingKey}"
        v-on:click="onRecordKey"><i class="fas fa-keyboard"></i>&nbsp;Record key</button>
  </div>

  <keybindings-category-list
    v-if="keybindings !== null"
    :keybindings="keybindings"
    :searchText="searchText"
    :commandsByCategory="commandsByCategory"
    v-on:${EVENT_START_KEY_INPUT}="$emit('${EVENT_START_KEY_INPUT}')"
    v-on:${EVENT_END_KEY_INPUT}="$emit('${EVENT_END_KEY_INPUT}')">
  </keybindings-category-list>
</div>
`)
  }
)
export class KeybindingsSettingsUi extends Vue {
  keybindingsInfoList: KeybindingsInfo[] = [];

  keybindings: KeybindingsSet = null;
  selectedKeybindings: LogicalKeybindingsName = "pc-style";
  commandsByCategory: { [index: string]: ExtensionCommandContribution[] } = {};

  searchText: string = "";

  recordingKey: boolean = false;

  get allKeybindingFiles(): KeybindingsInfo[] {
    return allKeybindingFiles;
  }

  onRecordKey(): void {
    this.recordingKey = ! this.recordingKey;
    if (this.recordingKey) {
      this.$emit(EVENT_START_KEY_INPUT);
    } else {
      this.$emit(EVENT_END_KEY_INPUT);
    }
  }

  onKeyInputSelected(keybindingString: string): void {
    const enteredKeybinding = TermKeyStroke.parseConfigString(keybindingString);
    this.searchText = enteredKeybinding.formatHumanReadable();
    this.recordingKey = false;
    this.$emit(EVENT_END_KEY_INPUT);
  }

  onKeyInputCancelled(): void {
    this.recordingKey = false;
    this.$emit(EVENT_END_KEY_INPUT);
  }
}
