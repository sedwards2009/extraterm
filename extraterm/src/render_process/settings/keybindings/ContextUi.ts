/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { KeybindingsKeyInput, EVENT_SELECTED, EVENT_CANCELED } from './KeyInputUi';
import { KeybindingsFile, KeybindingsFileContext } from '../../../KeybindingsFile';
import { Keybinding } from '../../keybindings/KeyBindingsManager';

const humanText = require('../../keybindings/keybindingstext.json');

const CLASS_KEYCAP = "CLASS_KEYCAP";
export const EVENT_START_KEY_INPUT = "start-key-input";
export const EVENT_END_KEY_INPUT = "end-key-input";

type KeybindingsKeyInputState = "read" | "edit" | "conflict";


@Component({
  components: {
    "keybindings-key-input": KeybindingsKeyInput
  },
  props: {
    contextName: String,
    keybindingsFileContext: Object, //KeybindingsFileContext
    readOnly: Boolean
  },
  template: `
<div>
  <h2>{{contextHeading}}</h2>
  <table class='table'>
    <tbody>
      <tr>
        <th class="col-md-7">Command</th>
        <th class="col-md-5">Key</th>
      </tr>
      <tr v-for="command in commands" :key="command">
        <td class="col-md-7" :title="command">{{commandHumanName(command)}}</td>
        <td class="col-md-5">
          <template v-for="keybinding in commandToKeybindingsMapping.get(command)">
            <div class='${CLASS_KEYCAP}'>
              <span>{{keybinding.formatHumanReadable()}}</span>
            </div>
            <button v-if="!readOnly" v-on:click="deleteKey(command, keybinding)"><i class="fas fa-times"></i></button>
            <br />
          </template>
          <button v-if="effectiveInputState(command) === 'read'" v-on:click="addKey(command)"><i class="fas fa-plus"></i></button>
          <keybindings-key-input v-if="effectiveInputState(command) === 'edit' && selectedCommand === command"
            v-on:${EVENT_SELECTED}="onKeyInputSelected"
            v-on:${EVENT_CANCELED}="onKeyInputCancelled"
            >
          </keybindings-key-input>
        </td>
      </tr>
    </tbody>
  </table>
</div>`,
})
export class KeybindingsContext extends Vue {
  // Props
  contextName: string;
  keybindingsFileContext: KeybindingsFileContext;
  readOnly: boolean;

  inputState: KeybindingsKeyInputState = "read";
  selectedCommand = "";
  conflictKey = "";

  get contextHeading(): string {
    const str = humanText.contextNames[this.contextName];
    return str || this.contextName;
  }

  get commands(): string[] {
    const commandCodes: string[] = [...humanText.contexts[this.contextName]];

    commandCodes.sort( (a,b): number => {
      const nameA = this.commandHumanName(a);
      const nameB = this.commandHumanName(b);
      return nameA < nameB ? -1 : ( nameA > nameB ? 1 : 0);
    });

    return commandCodes;
  }

  get commandToKeybindingsMapping(): Map<string, Keybinding[]> {
    const result = new Map<string, Keybinding[]>();

    for (const command of humanText.contexts[this.contextName]) {
      result.set(command, []);
    }

    for (const configKeyString of Object.keys(this.keybindingsFileContext)) {
      const command = this.keybindingsFileContext[configKeyString];
      if ( ! result.has(command)) {
        result.set(command, []);
      }
      result.get(command).push(Keybinding.parseConfigString(configKeyString));
    }
    return result;
  }

  effectiveInputState(command: string): KeybindingsKeyInputState {
    return command !== this.selectedCommand ? "read" : this.inputState;
  }

  commandHumanName(commandCode: string): string {
    const str = humanText.commands[commandCode];
    return str || commandCode;
  }

  deleteKey(command: string, keybinding: Keybinding): void {
    const configObjectKey = this._lookupConfigObjectKeyByKeybinding(keybinding);
    if (configObjectKey != null) {
        Vue.delete(this.keybindingsFileContext, configObjectKey);
    }
  }

  private _lookupConfigObjectKeyByKeybinding(keybinding: Keybinding): string {
    for (const keybindingString in this.keybindingsFileContext) {
      const currentKeybinding = Keybinding.parseConfigString(keybindingString);
      if (currentKeybinding.equals(keybinding)) {
        return keybindingString;
      }
    }
    return null;
  }

  addKey(command: string): void {
    this.inputState = "edit";
    this.selectedCommand = command;
    this.$emit(EVENT_START_KEY_INPUT);
  }

  get selectedCommandHumanName(): string {
    return this.commandHumanName(this.selectedCommand);
  }

  onKeyInputSelected(keybindingString: string): void {
console.log(`keyCode: ${keybindingString}`);
    const newKeybinding = Keybinding.parseConfigString(keybindingString);
    const existingConfigObjectKey = this._lookupConfigObjectKeyByKeybinding(newKeybinding);
// FIXME

    Vue.set(this.keybindingsFileContext, keybindingString, this.selectedCommand);
    this.inputState = "read";

    this.$emit(EVENT_END_KEY_INPUT);
  }

  onKeyInputCancelled(): void {
    this.inputState = "read";
    this.$emit(EVENT_END_KEY_INPUT);
  }
}
