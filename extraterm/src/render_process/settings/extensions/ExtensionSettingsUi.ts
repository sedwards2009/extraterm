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


export interface ExtensionMetadataAndState {
  metadata: ExtensionMetadata;
  running: boolean;
}

export const EVENT_ENABLE_EXTENSION = "enable-extension";
export const EVENT_DISABLE_EXTENSION = "disable-extension";


@Component(
  {
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="fas fa-puzzle-piece"></i>&nbsp;&nbsp;Extensions</h2>

  <div v-for="extension in allUserExtensions" v-bind:key="extension.path" class="card">
    <h3>{{ extension.metadata.displayName || extension.metadata.name }}&nbsp;<span class="extension-version">{{ extension.metadata.version }}</span></h3>
    <div>{{ extension.metadata.description}}</div>
    <div class="extension-controls">
      <span :class="{'traffic-light-running': extension.running, 'traffic-light-stopped': !extension.running}"></span>
      <span class="group">
        <button
          v-if="!extension.running"
          v-on:click="$emit('${EVENT_ENABLE_EXTENSION}', extension.metadata.name)"
          class="inline">
          <i class="fas fa-play"></i>&nbsp;Enable
        </button>
        <button
          v-if="extension.running"
          v-on:click="$emit('${EVENT_DISABLE_EXTENSION}', extension.metadata.name)"
          class="inline">
          <i class="fas fa-pause"></i>&nbsp;Disable
        </button>
      </span>
    </div>
  </div>
</div>
`)
  }
)
export class ExtensionSettingsUi extends Vue {

  allExtensions: ExtensionMetadataAndState[];

  constructor() {
    super();
    this.allExtensions = [];
  }

  get allUserExtensions(): ExtensionMetadataAndState[] {
    return this.allExtensions.filter(ex => ! ex.metadata.isInternal && isSupportedOnThisPlatform(ex.metadata));
  }
}
