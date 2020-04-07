/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { } from '../../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { isSupportedOnThisPlatform } from '../../extension/InternalTypes';
import { ExtensionCard } from './ExtensionCardUi';
import { ExtensionDetails } from './ExtensionDetailsUi';
import { ExtensionMetadataAndState } from './ExtensionMetadataAndStateType';


export const EVENT_ENABLE_EXTENSION = "enable-extension";
export const EVENT_DISABLE_EXTENSION = "disable-extension";


@Component(
  {
    components: {
      "extension-card": ExtensionCard,
      "extension-details": ExtensionDetails,
    },
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="fas fa-puzzle-piece"></i>&nbsp;&nbsp;Extensions</h2>

  <template v-if="selectedExtension == null">
    <extension-card
      v-for="extension in allUserExtensions"
      v-bind:key="extension.path"
      v-on:detail-click="selectedExtension = extension"
      :extension="extension"
      :showDetailsButton="true"
    ></extension-card>
  </template>

  <template v-else>
    <p>
      <a v-on:click="selectedExtension = null"><i class="fas fa-arrow-left"></i> All Extensions</a>
    </p>
    <extension-details
      :extension="selectedExtension"
    ></extension-details>
  </template>
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
