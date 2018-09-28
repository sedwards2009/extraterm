/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { KeybindingsContext, START_KEY_INPUT_EVENT, END_KEY_INPUT_EVENT } from './ContextUi';
import { KeybindingsFile } from '../../../KeybindingsFile';


const humanText = require('../keybindings/keybindingstext.json');


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
export class KeybindingsList extends Vue {
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
