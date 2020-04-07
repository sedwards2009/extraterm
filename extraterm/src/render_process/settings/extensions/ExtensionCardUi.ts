/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { } from '../../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ExtensionMetadataAndState } from './ExtensionMetadataAndStateType';


export const EVENT_ENABLE_EXTENSION = "enable-extension";
export const EVENT_DISABLE_EXTENSION = "disable-extension";


@Component(
  {
    props: {
      extension: Object,
    },  
    template: trimBetweenTags(`
  <div class="card">
    <h3>{{ extension.metadata.displayName || extension.metadata.name }}&nbsp;<span class="extension-version">{{ extension.metadata.version }}</span></h3>
    <div>{{ extension.metadata.description}}</div>
    <div><button v-on:click="$emit('detail-click')">Details</button></div>
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
`)
  }
)
export class ExtensionCard extends Vue {
  extension: ExtensionMetadataAndState;

  constructor() {
    super();
  }
}
