/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { KeybindingsContext, EVENT_START_KEY_INPUT, EVENT_END_KEY_INPUT } from './ContextUi';
import { KeybindingsFile } from '../../../KeybindingsFile';


const humanText = require('../../keybindings/keybindingstext.json');


@Component(
  {
    components: {
      "keybindings-context": KeybindingsContext
    },
    props: {
      keybindings: Object, //KeybindingsFile,
      readOnly: Boolean,
      searchText: String
    },
    template: `
    <div>
      <keybindings-context
        v-for="contextName in humanContexts"
        :contextName="contextName"
        :key="contextName"
        :keybindingsFileContext="keybindings[contextName]"
        :readOnly="readOnly"
        :searchText="searchText"
        v-on:${EVENT_START_KEY_INPUT}="$emit('${EVENT_START_KEY_INPUT}')"
        v-on:${EVENT_END_KEY_INPUT}="$emit('${EVENT_END_KEY_INPUT}')">
      </keybindings-context>
    </div>`
  }
)
export class KeybindingsList extends Vue {
  // Props
  keybindings: KeybindingsFile;
  readOnly: boolean;
  searchText: string;

  get humanContexts(): string[] {
    return Object.keys(humanText.contexts);
  }

  mounted() {
    console.log("this.keybindingsContexts != null is", this.keybindings != null);
  }
}
