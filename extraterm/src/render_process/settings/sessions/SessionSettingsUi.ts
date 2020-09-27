/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { createUuid } from 'extraterm-uuid';

import { ExtensionManager } from '../../extension/InternalTypes';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { SessionCardUi } from './SessionCardUi';


@Component({
  components: {
    "session-card": SessionCardUi,
  },
  template: trimBetweenTags(`
<div class="settings-page">
  <h2 class="no-user-select"><i class="fa fa-terminal"></i>&nbsp;&nbsp;Session Types</h2>

  <session-card
    v-for="(item, index) in sessions"
    v-bind:key="item.uuid"
    v-bind:uuid="item.uuid"
    v-bind:extensionManager="getExtensionManager()"
    v-bind:sessionConfiguration="item"
    v-bind:isDefault="index === 0"
    v-on:make-default="makeDefault"
    v-on:delete-session="deleteSession"
    v-on:change="handleChange"
    v-on:settings-change="handleSettingsChanged"
  />

  <div class="gui-layout cols-1">
    <span v-for="item in sessionTypes" v-bind:key="item.type">
      <button v-on:click="newSession(item.type)">New {{ item.name }} session type</button>
    </span>
  </div>
</div>
`)
})
export class SessionSettingsUi extends Vue {
  private _extensionManager: ExtensionManager = null;
  sessions: SessionConfiguration[] = [];

  extensionManagerStamp: any;

  constructor() {
    super();
    this.extensionManagerStamp = Date.now();
  }

  setExtensionManager(extensionManager: ExtensionManager): void {
    this._extensionManager = extensionManager;
    this.extensionManagerStamp = Date.now();
  }

  getExtensionManager(): ExtensionManager {
    return this._extensionManager;
  }

  get sessionTypes(): {name: string, type: string}[] {
    const bogusReadToTrickVue = this.extensionManagerStamp;
    if (this._extensionManager == null) {
      return [];
    }

    return this._extensionManager.getAllSessionTypes();
  }

  handleChange(newSessionConfig: SessionConfiguration): void {
    let i = 0;
    for (const session of this.sessions) {
      if (session.uuid === newSessionConfig.uuid) {
        this.sessions.splice(i, 1, newSessionConfig);
      }
      i++;
    }
  }

  private _getSessionByUUID(uuid: string): SessionConfiguration {
    for (const session of this.sessions) {
      if (session.uuid === uuid) {
        return session;
      }
    }
    return null;
  }

  handleSettingsChanged(uuid: string, settingsConfigKey: string, settings: Object): void {
    const session = this._getSessionByUUID(uuid);
    Vue.set(session.extensions, settingsConfigKey, settings);
  }

  newSession(type: string): void {
    const newSession: SessionConfiguration = { uuid: createUuid(), name: "new " + type, type, extensions: {}};
    this.sessions.push(newSession);
  }

  deleteSession(uuid: string): void {
    this.sessions.splice(this._indexOfUuid(uuid), 1);
  }

  makeDefault(uuid: string): void {
    const i = this._indexOfUuid(uuid);
    const session = this.sessions[i];
    this.sessions.splice(i, 1);
    this.sessions.splice(0, 0, session);
  }

  private _indexOfUuid(uuid: string): number {
    let i = 0;
    for (const session of this.sessions) {
      if (session.uuid === uuid) {
        return i;
      }
      i++;
    }
    return -1;
  }
}
