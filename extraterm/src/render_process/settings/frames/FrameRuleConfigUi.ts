/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { FrameRule } from '../../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';


@Component(
  {
    props: {
      frameRule: String,
      frameRuleLines: Number
    },
    template: trimBetweenTags(`
    <div class="gui-packed-row width-100pc">
      <select @change="onFrameRuleChange" class="char-width-20">
        <option v-for="option in frameRuleOptions" v-bind:value="option.id" v-bind:selected="option.id == frameRule">
          {{ option.name }}
        </option>
      </select>

      <input
        class="char-width-4"
        min="1"
        max="9999"
        v-if="frameRule == 'frame_if_lines'"
        type="number"
        v-bind:value="frameRuleLines"
        @change="onFrameRuleLinesChange"
      />
      <div v-if="frameRule == 'frame_if_lines'">&nbsp;lines</div>
    </div>`)
  }
)
export class FrameRuleConfigUi extends Vue {
  // Props
  frameRule: FrameRule;
  frameRuleLines: number;

  onFrameRuleChange(event: Event): void {
    this.$emit("update:frame-rule", (<HTMLSelectElement> event.target).value);
  }

  get frameRuleOptions(): {id: string, name: string}[] {
    return [
      { id: "always_frame", name: "Always frame command output" },
      { id: "never_frame", name: "Never frame command output" },
      { id: "frame_if_lines", name: "Frame command output if longer than" },
    ];
  }

  onFrameRuleLinesChange(event: Event): void {
    this.$emit("update:frame-rule-lines", (<HTMLInputElement> event.target).value);
  }
}
