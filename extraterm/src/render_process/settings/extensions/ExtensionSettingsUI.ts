/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { } from '../../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';


@Component(
  {
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="fas fa-puzzle-piece"></i>&nbsp;&nbsp;Extensions</h2>
</div>
`)
})
export class ExtensionSettingsUi extends Vue {

  constructor() {
    super();
  }
}
