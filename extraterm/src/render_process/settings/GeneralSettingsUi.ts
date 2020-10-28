/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { ShowTipsStrEnum, MouseButtonAction } from '../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

const ID_SCROLLBACK = "ID_SCROLLBACK";
const ID_SCROLLBACK_FRAMES = "ID_SCROLLBACK_FRAMES";


@Component(
  {
    props: {
      value: String,
    },
    template: trimBetweenTags(`
<select v-bind:value="value" v-on:input="$emit('input', $event.target.value)" class="char-width-12">
  <option value="none">None</option>
  <option value="paste">Paste from Clipboard</option>
  <option value="context_menu">Context Menu</option>
</select>
`)
  })
export class MouseActionDropdown extends Vue {
  // Props
  value: MouseButtonAction;
}

@Component(
  {
    components: {
      "mouse-action-dropdown": MouseActionDropdown,
    },
    template: trimBetweenTags(`
<div class="settings-page">
  <h2 class="no-user-select"><i class="fa fa-sliders-h"></i>&nbsp;&nbsp;General Settings</h2>

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
    <span><label><input type="checkbox" v-model="closeWindowWhenEmpty">Close the window after closing the last tab</label></span>

    <label></label>
    <span class="no-user-select">&nbsp;</span>

    <label></label>
    <span><label><input type="checkbox" v-model="gpuDriverWorkaroundFlag">Reduce graphic effects</label></span>

    <label></label>
    <span class="no-user-select">Some graphics hardware and driver combinations can give incorrect colors. Try this option if you are seeing unexpected changes to background colors.</span>
  </div>

  <h3 class="no-user-select">Mouse Button Actions</h3>
  <div class="gui-layout cols-1-2">
    <label>Middle</label>
    <mouse-action-dropdown v-model="middleMouseButtonAction"></mouse-action-dropdown>

    <label>Middle + Shift</label>
    <mouse-action-dropdown v-model="middleMouseButtonShiftAction"></mouse-action-dropdown>

    <label>Middle + Control</label>
    <mouse-action-dropdown v-model="middleMouseButtonControlAction"></mouse-action-dropdown>

    <label>Right</label>
    <mouse-action-dropdown v-model="rightMouseButtonAction"></mouse-action-dropdown>

    <label>Right + Shift</label>
    <mouse-action-dropdown v-model="rightMouseButtonShiftAction"></mouse-action-dropdown>

    <label>Right + Control</label>
    <mouse-action-dropdown v-model="rightMouseButtonControlAction"></mouse-action-dropdown>
  </div>
</div>
`)
  }
)
export class GeneralSettingsUi extends Vue {

  showTips: ShowTipsStrEnum;
  showTipsOptions:{ id: ShowTipsStrEnum, name: string; }[];

  maxScrollbackLines: number;
  maxScrollbackFrames: number;
  autoCopySelectionToClipboard: boolean;
  gpuDriverWorkaroundFlag: boolean;
  closeWindowWhenEmpty: boolean;
  middleMouseButtonAction: MouseButtonAction;
  middleMouseButtonShiftAction: MouseButtonAction;
  middleMouseButtonControlAction: MouseButtonAction;
  rightMouseButtonAction: MouseButtonAction;
  rightMouseButtonShiftAction: MouseButtonAction;
  rightMouseButtonControlAction: MouseButtonAction;

  constructor() {
    super();
    this.showTips = 'always';
    this.showTipsOptions = [ { id: 'always', name: 'Everytime' }, { id: 'daily', name: 'Daily'}, { id: 'never', name: 'Never'} ];
    this.maxScrollbackLines = 500000;
    this.maxScrollbackFrames = 100;
    this.autoCopySelectionToClipboard = true;
    this.gpuDriverWorkaroundFlag = false;
    this.closeWindowWhenEmpty = true;
    this.middleMouseButtonAction = "paste";
    this.middleMouseButtonShiftAction = "paste";
    this.middleMouseButtonControlAction = "paste";
    this.rightMouseButtonAction = "context_menu";
    this.rightMouseButtonShiftAction = "context_menu";
    this.rightMouseButtonControlAction = "context_menu";
  }
}
