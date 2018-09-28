/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';
import { KeybindingsInfo } from '../../Config';
import { KeybindingsFile, KeybindingsFileContext } from '../../KeybindingsFile';

const humanText = require('../keybindings/keybindingstext.json');

const CLASS_KEYCAP = "CLASS_KEYCAP";

@Component({
  props: {
    commandHumanName: String
  },
  template: `<input
    ref="input"
    class="form-control"
    placeholder="Type a key"
    v-on:keypress.capture="onKeyPress"
    v-on:blur="onCancel" />`
})
class KeybindingsKeyInput extends Vue {
  // Props
  commandHumanName: string;

  mounted(): void {
    this.$nextTick(() => (<HTMLInputElement>this.$refs.input).focus());
  }

  onCancel(): void {
    this.$emit("cancelled");
  }

  onKeyPress(event: KeyboardEvent): void {
    console.log(event);
  }
}

type KeybindingsKeyInputState = "read" | "edit" | "conflict";
export const START_KEY_INPUT_EVENT = "start-key-input";
export const END_KEY_INPUT_EVENT = "end-key-input";


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
          <template v-for="key in commandToKeysMapping.get(command)">
            <div class='${CLASS_KEYCAP}'>
              <span>{{formatKey(key)}}</span>
            </div>
            <button v-if="!readOnly" v-on:click="deleteKey(command, key)"><i class="fas fa-times"></i></button>
            <br />
          </template>
          <button v-if="effectiveInputState(command) === 'read'" v-on:click="addKey(command)"><i class="fas fa-plus"></i></button>
          <keybindings-key-input v-if="effectiveInputState(command) === 'edit' && selectedCommand===command"
            :commandHumanName="selectedCommandHumanName"
            v-on:selected="onKeyInputSelected"
            v-on:cancelled="onKeyInputCancelled"
            >
          </keybindings-key-input>
        </td>
      </tr>
    </tbody>
  </table>
</div>`,
})
class KeybindingsContext extends Vue {
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

  get commandToKeysMapping(): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const command of humanText.contexts[this.contextName]) {
      result.set(command, []);
    }

    for (const key of Object.keys(this.keybindingsFileContext)) {
      const command = this.keybindingsFileContext[key];
      if ( ! result.has(command)) {
        result.set(command, []);
      }
      result.get(command).push(key);
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

  formatKey(code: string): string {
    if (process.platform !== "darwin") {
      return code;
    }
    let parts = code.split(/\+/g);
    parts = parts.map( (p) => {
      switch (p) {
        case 'Cmd':
          return '\u2318';
        case 'Shift':
          return '\u21E7';
        case 'Alt':
          return '\u2325';
        case 'Ctrl':
          return '^';
        default:
          return p;
      }
    } );
    return parts.join("");
  }

  deleteKey(command: string, key: string): void {
    Vue.delete(this.keybindingsFileContext, key);
  }

  addKey(command: string): void {
    this.inputState = "edit";
    this.selectedCommand = command;
    this.$emit(START_KEY_INPUT_EVENT);
  }

  get selectedCommandHumanName(): string {
    return this.commandHumanName(this.selectedCommand);
  }

  onKeyInputSelected(keyCode: string): void {
    console.log(`keyCode: ${keyCode}`);


    this.inputState = "read";

    this.$emit(END_KEY_INPUT_EVENT);

  }

  onKeyInputCancelled(): void {
    this.inputState = "read";
    this.$emit(END_KEY_INPUT_EVENT);
  }
}

@Component(
  {
    components: {
      "keybindings-context": KeybindingsContext
    },
    props: {
      keybindings: Object, //KeybindingsFile,
      readOnly: Boolean
    },
    template: `
    <div>
      <keybindings-context
        v-for="contextName in humanContexts"
        :contextName="contextName"
        :key="contextName"
        :keybindingsFileContext="keybindings[contextName]"
        :readOnly="readOnly"
        v-on:${START_KEY_INPUT_EVENT}="$emit('${START_KEY_INPUT_EVENT}')"
        v-on:${END_KEY_INPUT_EVENT}="$emit('${END_KEY_INPUT_EVENT}')">
      </keybindings-context>
    </div>`
  }
)
class KeybindingsList extends Vue {
  // Props
  keybindings: KeybindingsFile;
  readOnly: boolean;

  get humanContexts(): string[] {
    return Object.keys(humanText.contexts);
  }
  mounted() {
    console.log("this.keybindingsContexts != null is", this.keybindings != null);
  }
}


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
