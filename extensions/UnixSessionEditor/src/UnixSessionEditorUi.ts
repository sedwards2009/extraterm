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
<div>
  <div class="gui-layout cols-1-2">
    <label for="name">Name:</label>
    <input type="text" name="name" v-model="name">

    <label>Shell:</label>
    <span>
      <label><input type="radio" value="1" v-model.number="useDefaultShell">Default login shell</label>
    </span>

    <label></label>
    <span>
      <label>
        <input v-bind:class="{'has-error': shellErrorMsg != ''}" type="radio" value="0" v-model.number="useDefaultShell">
          Other
      </label>
      <input id="other_shell" type="text" :disabled="useDefaultShell===1" v-model="shell" list="etcShells">
    </span>

    <template v-if="shellErrorMsg != ''">
      <label></label>
      <span><i class="fas fa-exclamation-triangle"></i> {{ shellErrorMsg }}</span>
    </template>

    <label for="args">Arguments:</label>
    <input type="text" name="args" v-model="args">
  </div>

  <datalist id="etcShells">
    <option v-for="item in etcShells" :value="item"></option>
  </datalist>
</div>`)
})
export class UnixSessionEditorUi extends Vue {
  name: string = "";
  shell: string = "";
  useDefaultShell: number = 1;
  shellErrorMsg = "";
  etcShells: string[] = [];
  args: string = "";
}
