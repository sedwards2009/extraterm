/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

@Component(
  {
    template: trimBetweenTags(`
<div class="gui-layout cols-1-2">
  <label for="name">Name:</label>
  <input type="text" name="name" v-model="name">

  <label class="col-sm-4 control-label">Shell:</label>
  <span>
    <label>
      <input class="input-radio" type="radio" value="1" v-model.number="useDefaultShell">
      Default login shell
    </label>
  </span>

  <label></label>
  <span>
    <label>
      <input class="input-radio" type="radio" value="0" v-model.number="useDefaultShell">
      Other
    </label>

    <input id="other_shell" type="text" :disabled="useDefaultShell===1" v-model="shell" list="etcShells">
    <span v-if="shellErrorMsg != ''">&nbsp;
      <i class="fas fa-exclamation-triangle"></i> {{ shellErrorMsg }}
    </span>
    <datalist id="etcShells">
      <option v-for="item in etcShells" :value="item"></option>
    </datalist>
  </span>

  <label for="name">Arguments:</label>
  <input type="text" name="args" v-model="args">

  <label for="initialDirectory">Initial Directory:</label>
  <input type="text" name="initialDirectory" v-model="initialDirectory">
</div>
`)
  }
)
export class WslProxySessionEditorUi extends Vue {
  name: string = "";
  shell: string = "";
  useDefaultShell: number = 1;
  shellErrorMsg = "";
  etcShells = [];
  args = "";
  initialDirectory = "";
}
