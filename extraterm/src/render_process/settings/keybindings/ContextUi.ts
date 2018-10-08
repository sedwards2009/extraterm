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
    readOnly: Boolean,
    searchText: String,
  },
  template: `
<div>
  <h2>{{contextHeading}}
    <span v-if="allCommands.length !== commands.length" class="badge">{{commands.length}} / {{allCommands.length}}</span>
  </h2>
  <table v-if="commands.length !== 0" v-bind:class="{table: true, 'table-hover': !readOnly}">
    <thead>
      <tr>
        <th class="col-md-6">Command</th>
        <th class="col-md-6">Key</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="command in commands" :key="command" class="command-row">
        <td class="col-md-6" :title="command">{{commandHumanName(command)}}</td>
        <td class="col-md-6">
          <template v-for="(keybinding, index) in commandToKeybindingsMapping.get(command)">
            <br v-if="index !== 0" />
            <div class='${CLASS_KEYCAP}'>
              <span>{{keybinding.formatHumanReadable()}}</span>
            </div>

            <button
                v-if="!readOnly"
                v-on:click="deleteKey(command, keybinding)"
                class="btn btn-microtool-danger"
                title="Remove keybinding">
              <i class="fas fa-times"></i>
            </button>
          </template>

          <button
              v-if="!readOnly && effectiveInputState(command) === 'read'"
              v-on:click="addKey(command)"
              class="btn btn-microtool-success"
              title="Add keybinding">
            <i class="fas fa-plus"></i>
          </button>

          <keybindings-key-input
            v-if="effectiveInputState(command) === 'edit' && selectedCommand === command"
            v-on:${EVENT_SELECTED}="onKeyInputSelected"
            v-on:${EVENT_CANCELED}="onKeyInputCancelled">
          </keybindings-key-input>

          <template v-if="effectiveInputState(command) === 'conflict'">
            <div class='${CLASS_KEYCAP}'>
              <span>{{conflictKeyHumanReadable}}</span>
            </div>
            conflicts with command "{{commandHumanName(conflictCommand)}}".
            <button title="Replace" class="btn btn-default" v-on:click="onReplaceConflict">Replace</button>
            <button title="Cancel" class="btn btn-default" v-on:click="onCancelConflict">Cancel</button>
          </template>
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
  searchText: string;

  inputState: KeybindingsKeyInputState = "read";
  selectedCommand = "";
  conflictKey = "";
  conflictCommand = "";

  get contextHeading(): string {
    const str = humanText.contextNames[this.contextName];
    return str || this.contextName;
  }

  get allCommands(): string[] {
    return humanText.contexts[this.contextName];
  }

  get commands(): string[] {
    const commandCodes: string[] = [...humanText.contexts[this.contextName]];

    commandCodes.sort( (a,b): number => {
      const nameA = this.commandHumanName(a);
      const nameB = this.commandHumanName(b);
      return nameA < nameB ? -1 : ( nameA > nameB ? 1 : 0);
    });

    if (this.searchText.trim() !== "") {
      const searchString = this.searchText.toLowerCase().trim();
      return commandCodes.filter(a => this.commandHumanName(a).toLowerCase().indexOf(searchString)!==-1);
    } else {
      return commandCodes;
    }
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
    return command === this.selectedCommand ? this.inputState : "read";
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
    const newKeybinding = Keybinding.parseConfigString(keybindingString);
    const existingConfigObjectKey = this._lookupConfigObjectKeyByKeybinding(newKeybinding);
    if (existingConfigObjectKey == null) {
      Vue.set(this.keybindingsFileContext, keybindingString, this.selectedCommand);
      this.inputState = "read";
    } else {

      this.conflictKey = keybindingString;
      this.conflictCommand = this.keybindingsFileContext[existingConfigObjectKey];
      this.inputState = "conflict";
    }

    this.$emit(EVENT_END_KEY_INPUT);
  }

  onKeyInputCancelled(): void {
    this.inputState = "read";
    this.$emit(EVENT_END_KEY_INPUT);
  }

  get conflictKeyHumanReadable(): string {
    return Keybinding.parseConfigString(this.conflictKey).formatHumanReadable();
  }

  onReplaceConflict(): void {
    const newKeybinding = Keybinding.parseConfigString(this.conflictKey);
    const existingConfigObjectKey = this._lookupConfigObjectKeyByKeybinding(newKeybinding);
    Vue.set(this.keybindingsFileContext, existingConfigObjectKey, this.selectedCommand);

    this.selectedCommand = "";
    this.conflictKey = "";
    this.inputState = "read";
  }

  onCancelConflict(): void {
    this.selectedCommand = "";
    this.conflictKey = "";
    this.inputState = "read";
  }
}
