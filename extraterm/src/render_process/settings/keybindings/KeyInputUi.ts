/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';


@Component({
  props: {
    commandHumanName: String
  },
  template: `<input
    ref="input"
    class="form-control"
    placeholder="Type a key"
    v-on:keypress.capture="onKeyPress"
    v-on:blur="onCancel" />`
})
export class KeybindingsKeyInput extends Vue {
  // Props
  commandHumanName: string;

  mounted(): void {
    this.$nextTick(() => (<HTMLInputElement>this.$refs.input).focus());
  }

  onCancel(): void {
    this.$emit("cancelled");
  }

  onKeyPress(event: KeyboardEvent): void {
    console.log(event);
  }
}
