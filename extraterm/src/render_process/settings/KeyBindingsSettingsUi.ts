/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';
import { KeyBindingInfo } from '../../Config';
import { KeyBindingsMapping, KeyBindingsContexts } from '../keybindings/KeyBindingManager';

const humanText = require('../keybindings/keybindingstext.json');

const CLASS_KEYCAP = "CLASS_KEYCAP";

@Component(
  {
    template: `
<div class="settings-page">
  <h2><i class="far fa-keyboard"></i>&nbsp;&nbsp;Key Bindings</h2>

  <div className=''>
    <div class="form-horizontal">
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-4 control-label">Key bindings style:</label>
        <div class="col-sm-8">
          <select class="form-control" id="keybindings-style" v-model="selectedKeyBindings">
            <option v-for="option in keyBindingsFiles" v-bind:value="option.filename">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
  <div v-html="summary"></div>
</div>
`
})
export class KeyBindingsSettingsUi extends Vue {
  private __keyBindingsContexts: KeyBindingsContexts = null;

  selectedKeyBindings: string;
  keyBindingsFiles: KeyBindingInfo[];
  keyBindingsContextsStamp: any;

  constructor() {
    super();
    this.selectedKeyBindings = "";
    this.keyBindingsFiles = [];
    this.keyBindingsContextsStamp = Date.now();
  }

  get summary(): string {
    const foo = this.keyBindingsContextsStamp;
    return this.__keyBindingsContexts == null ? "" : formatKeyBindingsPage(this.__keyBindingsContexts);
  }

  setKeyBindingsContexts(keyBindingsContexts: KeyBindingsContexts): void {
    this.__keyBindingsContexts = keyBindingsContexts;
    this.keyBindingsContextsStamp = Date.now();
    this.$forceUpdate();
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

function formatKeyBindingsPage(keyBindingContexts: KeyBindingsContexts): string {
  return contexts()
    .map( (contextName) => {
        return `<h2>${contextHeading(contextName)}</h2>` +  formatKeyBindingsMapping(keyBindingContexts.context(contextName));
      } ).join("");
}

function formatKeyBindingsMapping(context: KeyBindingsMapping): string {
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
