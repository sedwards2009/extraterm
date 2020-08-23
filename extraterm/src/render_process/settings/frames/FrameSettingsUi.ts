/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { CommandLineAction, FrameRule } from '../../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { FrameRuleConfigUi } from './FrameRuleConfigUi';


export interface Identifiable {
  id?: string;
}

export interface IdentifiableCommandLineAction extends CommandLineAction, Identifiable {
}

let idCounter = 0;
export function nextId(): string {
  idCounter++;
  return "" + idCounter;
}


@Component(
  {
    components: {
      "frame-rule-config": FrameRuleConfigUi
    },
    template: trimBetweenTags(`
<div class="settings-page">
  <h2 class="no-user-select"><i class="far fa-window-maximize"></i>&nbsp;&nbsp;Frame Handling Rules</h2>

  <div class="gui-packed-row width-100pc">
    <label class="char-width-8">Default action:</label>
    <frame-rule-config
      :frame-rule.sync="frameRule"
      :frame-rule-lines.sync="frameRuleLines"
    />
  </div>

  <div v-for="commandLineAction in commandLineActions" v-bind:key="commandLineAction.id" class="frame-configuration card">
    <h3 class="no-user-select">Rule: {{commandLineAction.match}}</h3>
    <div class="frame-card-buttons">
      <button v-on:click="deleteCommandLineAction(commandLineAction.id);" class="microtool danger"><i class="fa fa-times"></i></button>
    </div>

    <div class="gui-layout cols-1-2 width-100pc">
      <label>Match:</label>
      <div class="gui-packed-row width-100pc">
        <input type="text" class="expand" v-model="commandLineAction.match" debounce="500" spellcheck="false" />
        <select v-model="commandLineAction.matchType" class="char-width-12">
          <option value="name">Match command name</option>
          <option value="regexp">Match regular expression</option>
        </select>
      </div>

      <label>Action:</label>
      <frame-rule-config
        :frame-rule.sync="commandLineAction.frameRule"
        :frame-rule-lines.sync="commandLineAction.frameRuleLines"
      />
    </div>
  </div>

  <button @click="addCommandLineAction">New Rule</button>
  <p class="no-user-select">
  Add rules to customize whether different commands are framed or not.
  </p>
</div>
`)
  }
)
export class FrameSettingsUi extends Vue {

  frameByDefault: "true" | "false" = "true";

  commandLineActions: IdentifiableCommandLineAction[] = [];
  frameRule: FrameRule = "always_frame";
  frameRuleLines = 5;

  constructor() {
    super();
    this.commandLineActions = [];
  }

  addCommandLineAction(): void {
    const emptyAction: IdentifiableCommandLineAction = {
      match: "",
      matchType: "name",
      id: nextId(),
      frameRule: "always_frame",
      frameRuleLines: 1
    };
    this.commandLineActions.push(emptyAction);
  }

  deleteCommandLineAction(id: string): void {
    const index = this.commandLineActions.findIndex(cla => cla.id === id);
    if (index !== -1) {
      this.commandLineActions.splice(index, 1);
    }
  }
}
