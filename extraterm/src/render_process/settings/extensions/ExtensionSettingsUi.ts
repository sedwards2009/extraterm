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
import { isSupportedOnThisPlatform } from '../../extension/InternalTypes';
import { ExtensionCard } from './ExtensionCardUi';


export interface ExtensionMetadataAndState {
  metadata: ExtensionMetadata;
  running: boolean;
}

export const EVENT_ENABLE_EXTENSION = "enable-extension";
export const EVENT_DISABLE_EXTENSION = "disable-extension";


@Component(
  {
    components: {
      "extension-card": ExtensionCard
    },
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="fas fa-puzzle-piece"></i>&nbsp;&nbsp;Extensions</h2>
  <extension-card
    v-for="extension in allUserExtensions"
    v-bind:key="extension.path"
    v-on:detail-click="selectedExtension = extension"
    :extension="extension"
  ></extension-card>
  <div v-if="selectedExtension != null">
    We have a selected extension
  </div>
</div>
`)
  }
)
export class ExtensionSettingsUi extends Vue {

  allExtensions: ExtensionMetadataAndState[];

  selectedExtension: ExtensionMetadataAndState = null;

  constructor() {
    super();
    this.allExtensions = [];
  }

  get allUserExtensions(): ExtensionMetadataAndState[] {
    return this.allExtensions.filter(ex => ! ex.metadata.isInternal && isSupportedOnThisPlatform(ex.metadata));
  }
}
