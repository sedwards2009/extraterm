/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { KeybindingsKeyInput, EVENT_SELECTED, EVENT_CANCELED } from './KeyInputUi';
import { KeybindingsFile } from '../../../keybindings/KeybindingsFile';
import { TermKeyStroke } from '../../keybindings/KeyBindingsManager';
import { Emulator, Platform } from '../../emulator/Term';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ExtensionManager } from '../../extension/InternalTypes';
import { Category, ExtensionCommandContribution } from '../../../ExtensionMetadata';

export const EVENT_START_KEY_INPUT = "start-key-input";
export const EVENT_END_KEY_INPUT = "end-key-input";

type KeybindingsKeyInputState = "read" | "edit" | "conflict";


interface CommandKeybindingPair {
  command: string;
  keybindingString: string;
  index: number;
};


@Component({
  components: {
    "keybindings-key-input": KeybindingsKeyInput
  },
  props: {
    category: String,
    categoryName: String,
    keybindings: Object,      // KeybindingsFile,
    extensionManager: Object, // ExtensionManager
    readOnly: Boolean,
    searchText: String,
  },
  watch: {
    keybindings: {
      deep: true,
      handler: () => {},
    }
  },
  template: trimBetweenTags(`
<div>
  <h3>{{categoryName}}
    <span v-if="allCommands.length !== commands.length" class="badge">{{commands.length}} / {{allCommands.length}}</span>
  </h3>
  <table v-if="commands.length !== 0" v-bind:class="{'width-100pc': true, 'table-hover': !readOnly}">
    <thead>
      <tr>
        <th width="50%">Command</th>
        <th width="50%">Key</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="command in commands" :key="command.command" class="command-row">
        <td :title="command">{{command.title}}</td>
        <td class="keybindings-key-colomn">
          <template v-for="(keybinding, index) in commandToKeybindingsMapping.get(command.command)">
            <br v-if="index !== 0" />
            <div class="keycap">
              <span>{{keybinding.formatHumanReadable()}}</span>
            </div>

            <i
                v-if="termConflict(keybinding)"
                title="This may override the terminal emulation"
                class="fas fa-exclamation-triangle"
            ></i>

            <button
                v-if="!readOnly"
                v-on:click="deleteKey(keybinding)"
                class="microtool danger"
                title="Remove keybinding">
              <i class="fas fa-times"></i>
            </button>
          </template>

          <button
              v-if="!readOnly && effectiveInputState(command) === 'read'"
              v-on:click="addKey(command.command)"
              class="microtool success"
              title="Add keybinding">
            <i class="fas fa-plus"></i>
          </button>

          <keybindings-key-input
            v-if="effectiveInputState(command) === 'edit' && selectedCommand === command.command"
            v-on:${EVENT_SELECTED}="onKeyInputSelected"
            v-on:${EVENT_CANCELED}="onKeyInputCancelled">
          </keybindings-key-input>

          <template v-if="effectiveInputState(command) === 'conflict'">
            <div class="keycap">
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
</div>`),
})
export class KeybindingsCategory extends Vue {
  // Props
  category: Category;
  categoryName: string;
  keybindings: KeybindingsFile;
  readOnly: boolean;
  searchText: string;
  extensionManager: ExtensionManager;

  inputState: KeybindingsKeyInputState = "read";
  selectedCommand = "";
  conflictKey = "";
  conflictCommand = "";

  get allCommands(): ExtensionCommandContribution[] {
    if (this.extensionManager == null) {
      return [];
    }
    const result = this.extensionManager.queryCommands({categories: [this.category]});
    return result;
  }

  get commands(): ExtensionCommandContribution[] {
    const commands = this.allCommands;

    if (this.searchText.trim() !== "") {
      const searchString = this.searchText.toLowerCase().trim();
      const filteredCommands = commands.filter((command): boolean => {
        if (command.title.toLowerCase().indexOf(searchString) !== -1) {
          return true;
        }
        const commandToKeybindingsMapping = this.commandToKeybindingsMapping;

        // Also match the search string against the current bindings for the command.
        if ( ! commandToKeybindingsMapping.has(command.command)) {
          return false;
        }

        const keybindingsList = commandToKeybindingsMapping.get(command.command);
        for (const keybinding of keybindingsList) {
          if (keybinding.formatHumanReadable().toLowerCase().indexOf(searchString) !== -1) {
            return true;
          }
        }
        return false;

      });
      return filteredCommands;
    } else {
      return commands;
    }
  }

  get commandToKeybindingsMapping(): Map<string, TermKeyStroke[]> {
    const result = new Map<string, TermKeyStroke[]>();
    for (const command of this.allCommands) {
      result.set(command.command, []);
    }

    for (const commandName of Object.keys(this.keybindings.bindings)) {
      const shortcuts = this.keybindings.bindings[commandName];
      result.set(commandName, shortcuts.map(TermKeyStroke.parseConfigString));
    }
    return result;
  }

  effectiveInputState(command: ExtensionCommandContribution): KeybindingsKeyInputState {
    return command.command === this.selectedCommand ? this.inputState : "read";
  }

  termConflict(keybinding: TermKeyStroke): boolean {
    if (["application", "window", "terminal", "viewer"].indexOf(this.category) === -1) {
      return false;
    }

    return Emulator.isKeySupported(<Platform> process.platform, keybinding);
  }

  deleteKey(keybinding: TermKeyStroke): void {
    const commandConfig = this._findCommandByKeybinding(keybinding);
    if (commandConfig != null) {
      const list = this.keybindings.bindings[commandConfig.command];
      Vue.delete(list, commandConfig.index);
    }
  }

  private _findCommandByKeybinding(keybinding: TermKeyStroke): CommandKeybindingPair {
    for (const commandContrib of this.allCommands) {
      const shortcuts = this.keybindings.bindings[commandContrib.command];
      if (shortcuts != null) {
        for (let i=0; i<shortcuts.length; i++) {
          const currentKeybinding = TermKeyStroke.parseConfigString(shortcuts[i]);
          if (currentKeybinding.equals(keybinding)) {
            return { command: commandContrib.command, keybindingString: shortcuts[i], index: i };
          }
        }
      }
    }
    return null;
  }

  addKey(command: string): void {
    this.inputState = "edit";
    this.selectedCommand = command;
    this.$emit(EVENT_START_KEY_INPUT);
  }

  onKeyInputSelected(keybindingString: string): void {
    const newKeybinding = TermKeyStroke.parseConfigString(keybindingString);

    const existingCommandConfig = this._findCommandByKeybinding(newKeybinding);
    if (existingCommandConfig == null) {
      let newShortcuts: string[] = null;
      if (this.keybindings.bindings[this.selectedCommand] == null) {
        newShortcuts = [keybindingString];
      } else {
        newShortcuts = [...this.keybindings.bindings[this.selectedCommand], keybindingString];
      }
      Vue.set(this.keybindings.bindings, this.selectedCommand, newShortcuts);
      this.inputState = "read";
    } else {
      this.conflictKey = keybindingString;
      this.conflictCommand = existingCommandConfig.command;
      this.inputState = "conflict";
    }

    this.$emit(EVENT_END_KEY_INPUT);
  }

  onKeyInputCancelled(): void {
    this.inputState = "read";
    this.$emit(EVENT_END_KEY_INPUT);
  }

  get conflictKeyHumanReadable(): string {
    return TermKeyStroke.parseConfigString(this.conflictKey).formatHumanReadable();
  }

  onReplaceConflict(): void {
    const newKeybinding = TermKeyStroke.parseConfigString(this.conflictKey);
    const existingCommandConfig = this._findCommandByKeybinding(newKeybinding);

    const shortcutsList = this.keybindings.bindings[existingCommandConfig.command];
    Vue.delete(shortcutsList, existingCommandConfig.index);
    
    const newShortcuts = [...shortcutsList, this.conflictKey];
    Vue.set(this.keybindings.bindings, existingCommandConfig.command, newShortcuts);

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
