/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { ShowTipsStrEnum, GpuDriverWorkaround } from '../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

const ID_SCROLLBACK = "ID_SCROLLBACK";
const ID_SCROLLBACK_FRAMES = "ID_SCROLLBACK_FRAMES";


@Component(
  {
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="fa fa-sliders-h"></i>&nbsp;&nbsp;General Settings</h2>
    
  <div class="gui-layout cols-1-2">
    <label for="tips">Show Tips:</label>
    <select id="tips" v-model="showTips" class="char-width-12">
      <option v-for="option in showTipsOptions" v-bind:value="option.id">
        {{ option.name }}
      </option>
    </select>
  
    <label for="${ID_SCROLLBACK}">Max. Scrollback Lines:</label>
    <span class="group"><input id="${ID_SCROLLBACK}" type="number" class="char-width-8"
        v-model.number="maxScrollbackLines" min="1" max="10000000" debounce="500" /><span>lines</span></span>

    <label for="${ID_SCROLLBACK_FRAMES}">Max. Scrollback Frames:</label>
    <span class="group"><input id="${ID_SCROLLBACK_FRAMES}" type="number" class="char-width-4"
        v-model.number="maxScrollbackFrames" min="1" max="1000" debounce="500" /><span>frames</span></span>

    <label></label>
    <span><label><input type="checkbox" v-model="autoCopySelectionToClipboard">Automatically copy selection to clipboard</label></span>

    <label></label>
    <span>&nbsp;</span>
    
    <label></label>
    <span><label><input type="checkbox" v-model="gpuDriverWorkaroundFlag">Reduce graphic effects</label></span>

    <label></label>
    <span>Some graphics hardware and driver combinations can give incorrect colors. Try this option if you are seeing unexpected changes to background colors etc.</span>
  </div>
</div>
`)
})
export class GeneralSettingsUi extends Vue {

  showTips: ShowTipsStrEnum;
  showTipsOptions:{ id: ShowTipsStrEnum, name: string; }[];
  
  maxScrollbackLines: number;
  maxScrollbackFrames: number;
  autoCopySelectionToClipboard: boolean;
  gpuDriverWorkaroundFlag: boolean;

  constructor() {
    super();
    this.showTips = 'always';
    this.showTipsOptions = [ { id: 'always', name: 'Everytime' }, { id: 'daily', name: 'Daily'}, { id: 'never', name: 'Never'} ];
    this.maxScrollbackLines = 500000;
    this.maxScrollbackFrames = 100;
    this.autoCopySelectionToClipboard = true;
    this.gpuDriverWorkaroundFlag = false;
  }
}
