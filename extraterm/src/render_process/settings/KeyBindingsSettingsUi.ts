/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';
import { KeybindingsInfo } from '../../Config';
import { KeybindingsMapping, KeybindingsContexts } from '../keybindings/KeyBindingsManager';

const humanText = require('../keybindings/keybindingstext.json');

const CLASS_KEYCAP = "CLASS_KEYCAP";

@Component(
  {
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
          <button title="Rename" class="btn btn-default" v-bind:disabled="isSelectedKeybindingsReadOnly()" v-on:click="rename()"><i class="fas fa-edit"></i></button>
          <button title="Delete" class="btn btn-default" v-bind:disabled="isSelectedKeybindingsReadOnly()" v-on:click="trash()"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  </div>
  <div v-html="summary"></div>
</div>
`
})
export class KeybindingsSettingsUi extends Vue {
  private __keybindingsContexts: KeybindingsContexts = null;

  selectedKeybindings: string;
  keybindingsInfoList: KeybindingsInfo[];
  keybindingsContextsStamp: any;

  constructor() {
    super();
    this.selectedKeybindings = "";
    this.keybindingsInfoList = [];
    this.keybindingsContextsStamp = Date.now();
  }

  isSelectedKeybindingsReadOnly(): boolean {
    for (const kbf of this.keybindingsInfoList) {
      if (kbf.name === this.selectedKeybindings) {
        return kbf.readOnly;
      }
    }
console.log("Unable to find KeybindingsInfo!");    
    return true;
  }

  get summary(): string {
    const foo = this.keybindingsContextsStamp;
    return this.__keybindingsContexts == null ? "" : formatKeybindingsPage(this.__keybindingsContexts);
  }

  setKeybindingsContexts(keyBindingsContexts: KeybindingsContexts): void {
    this.__keybindingsContexts = keyBindingsContexts;
    this.keybindingsContextsStamp = Date.now();
    this.$forceUpdate();
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

function contexts(): string[] {
  return humanText.contexts;
}

function commandName(commandCode: string): string {
  const str = humanText.commands[commandCode];
  return str || commandCode;
}

function contextHeading(contextName: string): string {
  const str = humanText.contextNames[contextName];
  return str || contextName;
}

function formatShortcut(code: string): string {
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

function formatKeybindingsPage(keyBindingContexts: KeybindingsContexts): string {
  return contexts()
    .map( (contextName) => {
        return `<h2>${contextHeading(contextName)}</h2>` +  formatKeybindingsMapping(keyBindingContexts.context(contextName));
      } ).join("");
}

function formatKeybindingsMapping(context: KeybindingsMapping): string {
  const bindings = _.clone(context.keyBindings);
  bindings.sort( (a,b): number => {
    const nameA = commandName(a.command);
    const nameB = commandName(b.command);
    return nameA < nameB ? -1 : ( nameA > nameB ? 1 : 0);
  });
  
  return `<table class='table'>
    <tbody>
    <tr>
      <th class="col-md-7">Command</th>
      <th class="col-md-2">Shortcut</th>
      <th class="col-md-3">Code</th>
    </tr>` +
      bindings.map( (binding) => `<tr>
        <td class="col-md-7">${commandName(binding.command)}</td>
        <td class="col-md-2"><div class='${CLASS_KEYCAP}'><span>${formatShortcut(binding.shortcut)}</span></div></td>
        <td class="col-md-3">${binding.command}</td></tr>`).join("\n") +
    "</tbody></table>";
}
