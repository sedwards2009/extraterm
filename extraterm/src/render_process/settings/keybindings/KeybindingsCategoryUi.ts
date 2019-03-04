/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { KeybindingsKeyInput, EVENT_SELECTED, EVENT_CANCELED } from './KeyInputUi';
import { KeybindingsFile, KeybindingsFileBinding } from '../../../keybindings/KeybindingsFile';
import { TermKeyStroke } from '../../keybindings/KeyBindingsManager';
import { Emulator, Platform } from '../../emulator/Term';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { Category, ExtensionCommandContribution } from '../../../ExtensionMetadata';

export const EVENT_START_KEY_INPUT = "start-key-input";
export const EVENT_END_KEY_INPUT = "end-key-input";

type KeybindingsKeyInputState = "read" | "edit" | "conflict";

@Component({
  components: {
    "keybindings-key-input": KeybindingsKeyInput
  },
  props: {
    category: String,
    categoryName: String,
    keybindings: Object,      // KeybindingsFile,
    commands: Array,          // ExtensionCommandContribution[]
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
    <span v-if="commands.length !== filteredCommands.length" class="badge">{{filteredCommands.length}} / {{commands.length}}</span>
  </h3>
  <table v-if="filteredCommands.length !== 0" v-bind:class="{'width-100pc': true, 'table-hover': !readOnly}">
    <thead>
      <tr>
        <th width="50%">Command</th>
        <th width="50%">Key</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="command in filteredCommands" :key="command.command" class="command-row">
        <td :title="command">{{command.title}}</td>
        <td class="keybindings-key-colomn">
          <template v-for="(keybinding, index) in commandToKeybindingsMapping.get(command.command)">
            <br v-if="index !== 0" />
            <div class="keycap">
              <span>{{keybinding.formatHumanReadable()}}</span>
            </div>
            &nbsp;
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
            conflicts with command "{{conflictCommandName}}".
            <button title="Replace" class="inline" v-on:click="onReplaceConflict">Replace</button>
            <button title="Cancel" class="inline" v-on:click="onCancelConflict">Cancel</button>
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
  commands: ExtensionCommandContribution[];

  inputState: KeybindingsKeyInputState = "read";
  selectedCommand = "";
  conflictKey = "";
  conflictCommand = "";
  conflictCommandName = "";

  get filteredCommands(): ExtensionCommandContribution[] {
    const commands = this.commands;

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
    for (const command of this.commands) {
      result.set(command.command, []);
    }

    for (const command of this.keybindings.bindings) {
      if (command.category === this.category) {
        result.set(command.command, command.keys.map(TermKeyStroke.parseConfigString));
      }
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

  deleteKey(keyStroke: TermKeyStroke): void {
    for (const keybinding of this.keybindings.bindings) {
      if (keybinding.category === this.category) {
        const shortcuts = keybinding.keys;

        for (let i=0; i<shortcuts.length; i++) {
          const currentKeyStroke = TermKeyStroke.parseConfigString(shortcuts[i]);
          if (currentKeyStroke.equals(keyStroke)) {
            Vue.delete(shortcuts, i);
            return;           
          }
        }
      }
    }
  }

  addKey(command: string): void {
    this.inputState = "edit";
    this.selectedCommand = command;
    this.$emit(EVENT_START_KEY_INPUT);
  }

  private _findKeybindingByKeyStroke(keyStrokeStroke: string): KeybindingsFileBinding {
    const keyStroke = TermKeyStroke.parseConfigString(keyStrokeStroke);

    for (const keybinding of this.keybindings.bindings) {
      if (keybinding.category === this.category) {
        const shortcuts = keybinding.keys;
        if (this._findKeyStrokeInKeys(keyStroke, shortcuts) !== -1) {
          return keybinding;
        }
      }
    }
    return null;
  }

  private _findKeyStrokeInKeys(keyStroke: TermKeyStroke, shortcuts: string[]): number {
    for (let i=0; i<shortcuts.length; i++) {
      const currentKeyStroke = TermKeyStroke.parseConfigString(shortcuts[i]);
      if (currentKeyStroke.equals(keyStroke)) {
        return i;
      }
    }
    return -1;
  }

  private _findKeybindingByCommand(command: string): KeybindingsFileBinding {
    for (const keybinding of this.keybindings.bindings) {
      if (keybinding.category === this.category && keybinding.command === command) {
        return keybinding;
      }
    }
    return null;
  }

  onKeyInputSelected(keyStrokeString: string): void {
    const conflictingKeybinding = this._findKeybindingByKeyStroke(keyStrokeString);
    if (conflictingKeybinding == null) {
      this._addKeyStrokeToCommandNoConflict(this.selectedCommand, keyStrokeString);
      this.inputState = "read";
    } else {
      this.conflictKey = keyStrokeString;
      this.conflictCommand = conflictingKeybinding.command;

      this.conflictCommandName = "";
      for (const commandContrib of this.commands) {
        if (commandContrib.command === conflictingKeybinding.command) {
          this.conflictCommandName = commandContrib.title;
        }
      }

      this.inputState = "conflict";
    }

    this.$emit(EVENT_END_KEY_INPUT);
  }

  private _addKeyStrokeToCommandNoConflict(command: string, keyStrokeString: string): void {
    const existingKeybinding = this._findKeybindingByCommand(command);
    if (existingKeybinding == null) {
      const newKeybinding = {
        command,
        category: this.category,
        keys: [keyStrokeString]
      };
      Vue.set(this.keybindings, "bindings", [...this.keybindings.bindings, newKeybinding]);
    } else {
      const newKeyStrokes = [...existingKeybinding.keys, keyStrokeString];
      Vue.set(existingKeybinding, "keys", newKeyStrokes);
    }
  }      

  onKeyInputCancelled(): void {
    this.inputState = "read";
    this.$emit(EVENT_END_KEY_INPUT);
  }

  get conflictKeyHumanReadable(): string {
    return TermKeyStroke.parseConfigString(this.conflictKey).formatHumanReadable();
  }

  onReplaceConflict(): void {
    this.deleteKey(TermKeyStroke.parseConfigString(this.conflictKey));
    this._addKeyStrokeToCommandNoConflict(this.selectedCommand, this.conflictKey);

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
