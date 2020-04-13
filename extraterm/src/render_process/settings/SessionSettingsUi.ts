/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { createUuid } from 'extraterm-uuid';

import { ExtensionManager } from '../extension/InternalTypes';
import { trimBetweenTags } from 'extraterm-trim-between-tags';


@Component(
  {
    template: trimBetweenTags(`
<div class="settings-page">
  <h2 class="no-user-select"><i class="fa fa-terminal"></i>&nbsp;&nbsp;Session Types</h2>

  <div v-for="(item, index) in sessions" v-bind:key="item.uuid" class="session-configuration card">
    <h3 class="session-name no-user-select">{{ item.name }}</h3>
    <div class="session-type no-user-select">{{getSessionTypeName(item.type)}}</div>

    <div class="session-card-buttons">
      <button v-if="index != 0" class="microtool primary" v-on:click="makeDefault(item.uuid)" title="Make default"><i class="fas fa-angle-double-up"></i></button>
      <div v-if="index == 0" class="no-user-select"><em>default</em></div>
      <button v-if="index != 0" class="microtool danger" v-on:click="deleteSession(item.uuid)"><i class="fa fa-times"></i></button>
    </div>
    <div>
      <component
        v-bind:is="sessionEditor(item.type)"
        v-bind:sessionConfiguration.prop="item"
        v-on:change="handleChange">
      </component>
    </div>
  </div>

  <div class="gui-layout cols-1">
    <span v-for="item in sessionTypes" v-bind:key="item.type">
      <button v-on:click="newSession(item.type)">New {{ item.name }} session type</button>
    </span>
  </div>
</div>
`)
  }
)
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

  get sessionTypes(): {name: string, type: string}[] {
    const bogusReadToTrickVue = this.extensionManagerStamp;
    if (this._extensionManager == null) {
      return [];
    }

    return this._extensionManager.getAllSessionTypes();
  }

  sessionEditor(type: string): string {
    return this._extensionManager.getSessionEditorTagForType(type);
  }

  handleChange(event: Event): void {
    const newSessionConfig = (<any>event.target).sessionConfiguration;
    let i = 0;
    for (const session of this.sessions) {
      if (session.uuid === newSessionConfig.uuid) {
        this.sessions.splice(i, 1, newSessionConfig);
      }
      i++;
    }
  }

  newSession(type: string): void {
    const newSession: SessionConfiguration = { uuid: createUuid(), name: "new " + type, type};
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

  getSessionTypeName(type: string): string {
    if (this._extensionManager == null) {
      return "";
    }

    for (const sessionType of this._extensionManager.getAllSessionTypes()) {
      if (sessionType.type === type) {
        return sessionType.name;
      }
    }
    return "";
  }
}
