/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { log, getLogger } from "extraterm-logging";
import { KeybindingsKeyInput, EVENT_SELECTED, EVENT_CANCELED } from './KeyInputUi';
import { KeybindingsSet, KeybindingsBinding, CustomKeybindingsSet, CustomKeybinding } from '../../../keybindings/KeybindingsTypes';
import { TermKeyStroke } from '../../keybindings/KeyBindingsManager';
import { Emulator, Platform } from '../../emulator/Term';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { Category, ExtensionCommandContribution } from '../../../ExtensionMetadata';

export const EVENT_START_KEY_INPUT = "start-key-input";
export const EVENT_END_KEY_INPUT = "end-key-input";

type KeybindingsKeyInputState = "read" | "edit" | "conflict";

interface CommandKeybindingInfo {
  command: string;
  baseKeybindingsList: string[];
  baseKeyStrokeList: TermKeyStroke[];

  customKeybinding: CustomKeybinding | null;
  customKeyStrokeList: TermKeyStroke[] | null;
}

const _log = getLogger("KeybindingsCategoryUi");


@Component({
  components: {
    "keybindings-key-input": KeybindingsKeyInput
  },
  props: {
    category: String,
    categoryName: String,
    baseKeybindingsSet: Object,      // KeybindingsSet,
    customKeybindingsSet: Object,   // CustomKeybindingsSet
    commands: Array,          // ExtensionCommandContribution[]
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
  <table v-if="filteredCommands.length !== 0" class="width-100pc table-hover">
    <thead>
      <tr>
        <th width="50%">Command</th>
        <th width="50%">Key</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="command in filteredCommands" v-bind:key="command.command" class="command-row">
        <td :title="'Command code: ' + command.command">{{command.title}}</td>
        <td class="keybindings-key-colomn">

          <button
              v-if="hasCommandCustomKeystrokes(command.command)"
              class="microtool warning"
              :title="revertWarningText(command.command)"
              v-on:click="revertKeys(command.command)"
            >
            <i class="fas fa-undo"></i>
          </button>

          <template v-for="(keybinding, index) in getKeystrokesForCommand(command.command)">
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
              v-on:click="deleteKey(command.command, keybinding)"
              class="microtool danger hover"
              title="Remove keybinding"
            >
              <i class="fas fa-times"></i>
            </button>
          </template>

          <button
              v-if="effectiveInputState(command) === 'read'"
              v-on:click="addKey(command.command)"
              class="microtool success hover"
              title="Add keybinding"
            >
            <i class="fas fa-plus"></i>
          </button>

          <keybindings-key-input
            v-if="effectiveInputState(command) === 'edit' && selectedCommand === command.command"
            v-on:${EVENT_SELECTED}="onKeyInputSelected"
            v-on:${EVENT_CANCELED}="onKeyInputCancelled">
          </keybindings-key-input>

          <template v-if="effectiveInputState(command) === 'conflict'">
            <br v-if="getKeystrokesForCommand(command.command).length !== 0"/>
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
  baseKeybindingsSet: KeybindingsSet;
  customKeybindingsSet: CustomKeybindingsSet;
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
      const filteredCommands = commands.filter((commandContribution): boolean => {
        if (commandContribution.title.toLowerCase().indexOf(searchString) !== -1) {
          return true;
        }
        const commandToKeybindingsMapping = this.commandToKeybindingsMapping;

        // Also match the search string against the current bindings for the command.
        if ( ! commandToKeybindingsMapping.has(commandContribution.command)) {
          return false;
        }

        const keybindingInfo = commandToKeybindingsMapping.get(commandContribution.command);
        const keyStrokeList = keybindingInfo.customKeyStrokeList == null
                                ? keybindingInfo.baseKeyStrokeList
                                : keybindingInfo.customKeyStrokeList;
        for (const keybinding of keyStrokeList) {
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

  get commandToKeybindingsMapping(): Map<string, CommandKeybindingInfo> {
    const result = new Map<string, CommandKeybindingInfo>();
    for (const commandContribution of this.commands) {
      if (commandContribution.category === this.category) {
        result.set(commandContribution.command, {
          command: commandContribution.command,
          baseKeybindingsList: [],
          baseKeyStrokeList: [],
          customKeybinding: null,
          customKeyStrokeList: null
        });
      }
    }

    for (const keybinding of this.baseKeybindingsSet.bindings) {
      if (keybinding.category === this.category) {
        const commandKeybindingsInfo = result.get(keybinding.command);
        if (commandKeybindingsInfo == null) {
          _log.warn(`Command '${keybinding.command}' is not registered, but is in the base keybindings set.`);
        } else {
          commandKeybindingsInfo.baseKeybindingsList = keybinding.keys;
          commandKeybindingsInfo.baseKeyStrokeList = keybinding.keys.map(TermKeyStroke.parseConfigString);
        }
      }
    }

    for (const customKeybinding of this.customKeybindingsSet.customBindings) {
      const commandKeybindingInfo = result.get(customKeybinding.command);
      if (commandKeybindingInfo != null) {
        commandKeybindingInfo.customKeybinding = customKeybinding;
        commandKeybindingInfo.customKeyStrokeList = customKeybinding.keys.map(TermKeyStroke.parseConfigString);
      }
    }

    return result;
  }

  getKeystrokesForCommand(command: string): TermKeyStroke[] {
    const info = this.commandToKeybindingsMapping.get(command);
    return info.customKeyStrokeList == null ? info.baseKeyStrokeList : info.customKeyStrokeList;
  }

  hasCommandCustomKeystrokes(command: string): boolean {
    const info = this.commandToKeybindingsMapping.get(command);
    if (info == null) {
      _log.warn(`hasCommandCustomKeystrokes() Unknown command '${command}'`);
      return false;
    }
    return info.customKeyStrokeList != null;
  }

  revertWarningText(command: string): string {
    const info = this.commandToKeybindingsMapping.get(command);
    if (info == null) {
      return "Revert to default";
    }
    return `Revert to default: ${info.baseKeyStrokeList.map(ks => ks.formatHumanReadable()).join(", ")}`;
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

  deleteKey(command: string, keyStroke: TermKeyStroke): void {
    const commandKeybindingInfo = this.commandToKeybindingsMapping.get(command);
    if (commandKeybindingInfo.customKeyStrokeList == null) {

      const newKeybinding: CustomKeybinding = {
        command,
        keys: commandKeybindingInfo.baseKeybindingsList.filter(
          keybinding=> ! TermKeyStroke.parseConfigString(keybinding).equals(keyStroke))
      };
      Vue.set(this.customKeybindingsSet, "customBindings", [...this.customKeybindingsSet.customBindings, newKeybinding]);
    } else {
      const newKeyStrokes = commandKeybindingInfo.customKeybinding.keys.filter(
        keybinding=> ! TermKeyStroke.parseConfigString(keybinding).equals(keyStroke));
      Vue.set(commandKeybindingInfo.customKeybinding, "keys", newKeyStrokes);
    }
  }

  addKey(command: string): void {
    this.inputState = "edit";
    this.selectedCommand = command;
    this.$emit(EVENT_START_KEY_INPUT);
  }

  revertKeys(command: string): void {
    Vue.set(this.customKeybindingsSet, "customBindings",
      this.customKeybindingsSet.customBindings.filter(ck => ck.command !== command));
  }

  private _findCommandByKeyStroke(keyStrokeStroke: string): string {
    const keyStroke = TermKeyStroke.parseConfigString(keyStrokeStroke);

    for (const keybinding of this.baseKeybindingsSet.bindings) {
      if (keybinding.category === this.category) {
        const shortcuts = keybinding.keys;
        if (this._findKeyStrokeInKeys(keyStroke, shortcuts) !== -1) {
          return keybinding.command;
        }
      }
    }

    for (const keybinding of this.customKeybindingsSet.customBindings) {
      const info = this.commandToKeybindingsMapping.get(keybinding.command);
      if (info != null) {
        const shortcuts = keybinding.keys;
        if (this._findKeyStrokeInKeys(keyStroke, shortcuts) !== -1) {
          return keybinding.command;
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

  onKeyInputSelected(keyStrokeString: string): void {
    const conflictingKeybindingCommand = this._findCommandByKeyStroke(keyStrokeString);
    if (conflictingKeybindingCommand == null) {
      this._addKeyStrokeToCommandNoConflict(this.selectedCommand, keyStrokeString);
      this.inputState = "read";
    } else {
      this.conflictKey = keyStrokeString;
      this.conflictCommand = conflictingKeybindingCommand;

      this.conflictCommandName = "";
      for (const commandContrib of this.commands) {
        if (commandContrib.command === conflictingKeybindingCommand) {
          this.conflictCommandName = commandContrib.title;
        }
      }

      this.inputState = "conflict";
    }

    this.$emit(EVENT_END_KEY_INPUT);
  }

  private _addKeyStrokeToCommandNoConflict(command: string, keyStrokeString: string): void {
    const commandKeybindingInfo = this.commandToKeybindingsMapping.get(command);
    if (commandKeybindingInfo.customKeybinding == null) {
      const newKeybinding: CustomKeybinding = {
        command,
        keys: [...commandKeybindingInfo.baseKeybindingsList, keyStrokeString]
      };
      Vue.set(this.customKeybindingsSet, "customBindings", [...this.customKeybindingsSet.customBindings, newKeybinding]);
    } else {
      const newKeyStrokes = [...commandKeybindingInfo.customKeybinding.keys, keyStrokeString];
      Vue.set(commandKeybindingInfo.customKeybinding, "keys", newKeyStrokes);
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
    this.deleteKey(this.conflictCommand, TermKeyStroke.parseConfigString(this.conflictKey));
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
