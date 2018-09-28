/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';
import { KeybindingsInfo } from '../../../Config';
import { KeybindingsFile } from '../../../KeybindingsFile';
import { START_KEY_INPUT_EVENT, END_KEY_INPUT_EVENT } from './ContextUi';
import { KeybindingsList } from './KeybindingsListUi';


@Component(
  {
    components: {
      "keybindings-contexts-list": KeybindingsList
    },

    template: `
<div class="settings-page">
  <h2><i class="far fa-keyboard"></i>&nbsp;&nbsp;Keybindings</h2>

  <div className=''>
    <div class="form-horizontal">
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-2 control-label">Keybindings:</label>
        <div class="col-sm-6">
          <select class="form-control" id="keybindings-style" v-model="selectedKeybindings">
            <option v-for="option in keybindingsInfoList" v-bind:value="option.name">
              {{ option.name }}
            </option>
          </select>
        </div>
        <div class="col-sm-4">
          <button title="Duplicate" class="btn btn-default" v-on:click="duplicate()"><i class="fas fa-copy"></i></button>
          <button title="Rename" class="btn btn-default" v-bind:disabled="isSelectedKeybindingsReadOnly" v-on:click="rename()"><i class="fas fa-edit"></i></button>
          <button title="Delete" class="btn btn-default" v-bind:disabled="isSelectedKeybindingsReadOnly" v-on:click="trash()"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  </div>
  <keybindings-contexts-list
    v-if="keybindings !== null"
    :keybindings="keybindings"
    :readOnly="isSelectedKeybindingsReadOnly"
    v-on:${START_KEY_INPUT_EVENT}="$emit('${START_KEY_INPUT_EVENT}')"
    v-on:${END_KEY_INPUT_EVENT}="$emit('${END_KEY_INPUT_EVENT}')">
  </keybindings-contexts-list>
</div>
`
})
export class KeybindingsSettingsUi extends Vue {
  keybindings: KeybindingsFile = null;
  selectedKeybindings: string = "";
  keybindingsInfoList: KeybindingsInfo[] = [];

  get isSelectedKeybindingsReadOnly(): boolean {
    for (const kbf of this.keybindingsInfoList) {
      if (kbf.name === this.selectedKeybindings) {
        return kbf.readOnly;
      }
    }
console.log(`Unable to find KeybindingsInfo for '${this.selectedKeybindings}'!`);
    return true;
  }

  duplicate(): void {
    this.$emit("duplicate", this.selectedKeybindings);
  }

  trash(): void {
    this.$emit("delete", this.selectedKeybindings);
  }

  rename(): void {
    console.log("rename");
  }
}
