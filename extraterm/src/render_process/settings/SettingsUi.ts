/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import {FontInfo, CommandLineAction, ShowTipsStrEnum, ConfigDistributor} from '../../Config';
import * as ThemeTypes from '../../theme/Theme';
import { APPEARANCE_SETTINGS_TAG } from './AppearanceSettings';
import { FRAME_SETTINGS_TAG } from './FrameSettings';


const ID_SCROLLBACK = "ID_SCROLLBACK";
const ID_SETTINGS = "ID_SETTINGS";
const ID_SCROLLBACK_FRAMES = "ID_SCROLLBACK_FRAMES";


for (const el of [APPEARANCE_SETTINGS_TAG, FRAME_SETTINGS_TAG]) {
  if (Vue.config.ignoredElements.indexOf(el) === -1) {
    Vue.config.ignoredElements.push(el);
  }
}


@Component(
  {
    template: `
<div id='${ID_SETTINGS}'>
  <section>
    <et-appearance-settings
      v-bind:configDistributor.prop="getConfigDistributor()"
      v-bind:themes.prop="themes" >
      </et-appearance-settings>
  </section>

  <section>
    <et-frame-settings
    v-bind:configDistributor.prop="getConfigDistributor()">
    </et-frame-settings>
  </section>

  <section>
    <h2>Settings</h2>
    <div className='settingsform'>
    
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
  </section>

</div>
`
})
export class SettingsUi extends Vue {
  private __configDistributor: ConfigDistributor = null;

  showTips: ShowTipsStrEnum;
  showTipsOptions:{ id: ShowTipsStrEnum, name: string; }[];
  
  maxScrollbackLines: number;
  maxScrollbackFrames: number;

  themes: ThemeTypes.ThemeInfo[];
  
  constructor() {
    super();
    this.themes = [];
    this.showTips = 'always';
    this.showTipsOptions = [ { id: 'always', name: 'Everytime' }, { id: 'daily', name: 'Daily'}, { id: 'never', name: 'Never'} ];
    this.maxScrollbackLines = 500000;
    this.maxScrollbackFrames = 100;
  }

  setConfigDistributor(configDistributor: ConfigDistributor) {
    this.__configDistributor = configDistributor;
    this.$forceUpdate();
  }

  getConfigDistributor(): ConfigDistributor {
    return this.__configDistributor;
  }
}
