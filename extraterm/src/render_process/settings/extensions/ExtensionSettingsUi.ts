/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { } from '../../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ExtensionMetadata } from 'extraterm/src/ExtensionMetadata';


@Component(
  {
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="fas fa-puzzle-piece"></i>&nbsp;&nbsp;Extensions</h2>

  <div v-for="extension in allExtensions" v-bind:key="extension.path" class="card">
    <h3>{{ extension.displayName || extension.name }}&nbsp;<span class="extension-version">{{ extension.version }}</span></h3>
    <div>{{ extension.description}}</div>
  </div>
</div>
`)
})
export class ExtensionSettingsUi extends Vue {

  allExtensions: ExtensionMetadata[];

  constructor() {
    super();
    this.allExtensions = [];
  }
}
