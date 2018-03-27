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
import { GENERAL_SETTINGS_TAG} from './GeneralSettings';


for (const el of [GENERAL_SETTINGS_TAG, APPEARANCE_SETTINGS_TAG, FRAME_SETTINGS_TAG]) {
  if (Vue.config.ignoredElements.indexOf(el) === -1) {
    Vue.config.ignoredElements.push(el);
  }
}

const ID_SETTINGS = "ID_SETTINGS";


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
    <et-general-settings
      v-bind:configDistributor.prop="getConfigDistributor()">
    </et-general-settings>
  </section>
</div>
`
})
export class SettingsUi extends Vue {
  private __configDistributor: ConfigDistributor = null;

  themes: ThemeTypes.ThemeInfo[];
  
  constructor() {
    super();
    this.themes = [];
  }

  setConfigDistributor(configDistributor: ConfigDistributor) {
    this.__configDistributor = configDistributor;
    this.$forceUpdate();
  }

  getConfigDistributor(): ConfigDistributor {
    return this.__configDistributor;
  }
}
