/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';

import { ShowTipsStrEnum } from '../../Config';

const ID_SCROLLBACK = "ID_SCROLLBACK";
const ID_SCROLLBACK_FRAMES = "ID_SCROLLBACK_FRAMES";


@Component(
  {
    template: `
<div>
  <h2><i class="fa fa-sliders"></i>&nbsp;&nbsp;General Settings</h2>
    
  <div class="form-horizontal">
    <div class="form-group">
      <label for="tips" class="col-sm-3 control-label">Show Tips:</label>
      <div class="input-group col-sm-4">
        <select class="form-control" id="tips" v-model="showTips">
          <option v-for="option in showTipsOptions" v-bind:value="option.id">
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>
    
    <div class="form-group">
      <label for="${ID_SCROLLBACK}" class="col-sm-3 control-label">Maximum Scrollback Lines:</label>
      <div class="input-group col-sm-2">
        <input id="${ID_SCROLLBACK}" type="number" class="form-control" v-model.number="maxScrollbackLines" min="1"
          max="10000000" debounce="500" />
        <div class="input-group-addon">lines</div>
      </div>
    </div>

    <div class="form-group">
      <label for="${ID_SCROLLBACK_FRAMES}" class="col-sm-3 control-label">Maximum Scrollback Frames:</label>
      <div class="input-group col-sm-2">
        <input id="${ID_SCROLLBACK_FRAMES}" type="number" class="form-control" v-model.number="maxScrollbackFrames" min="1"
          max="1000" debounce="500" />
        <div class="input-group-addon">frames</div>
      </div>
    </div>
  </div>
</div>
`
})
export class GeneralSettingsUi extends Vue {

  showTips: ShowTipsStrEnum;
  showTipsOptions:{ id: ShowTipsStrEnum, name: string; }[];
  
  maxScrollbackLines: number;
  maxScrollbackFrames: number;

  constructor() {
    super();
    this.showTips = 'always';
    this.showTipsOptions = [ { id: 'always', name: 'Everytime' }, { id: 'daily', name: 'Daily'}, { id: 'never', name: 'Never'} ];
    this.maxScrollbackLines = 500000;
    this.maxScrollbackFrames = 100;
  }
}
