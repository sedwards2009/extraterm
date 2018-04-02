/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';
import { ExtensionManager } from '../extension/InternalTypes';


@Component(
  {
    template: `
<div>
  <h2><i class="fa fa-terminal"></i>&nbsp;&nbsp;Sessions</h2>

  <div v-for="item in sessionTypes">
    {{ item.name }}
  </div>
</div>
`
})
export class SessionSettingsUi extends Vue {
  private _extensionManager: ExtensionManager = null;

  extensionManagerStamp: any;

  constructor() {
    super();
    this.extensionManagerStamp = Date.now();
  }

  setExtensionManager(extensionManager: ExtensionManager): void {
    this._extensionManager = extensionManager;
    this.extensionManagerStamp = Date.now();
  }

  get sessionTypes(): {name: string, type: string}[] {
    const bogusReadToTrickVue = this.extensionManagerStamp;
    if (this._extensionManager == null) {
      return [];
    }

    return this._extensionManager.getAllSessionTypes();
  }

}
