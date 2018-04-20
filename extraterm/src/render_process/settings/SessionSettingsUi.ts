/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { SessionConfiguration } from 'extraterm-extension-api';
import * as _ from 'lodash';
import { createUuid } from 'extraterm-uuid';

import { ExtensionManager } from '../extension/InternalTypes';


@Component(
  {
    template: `
<div>
  <h2><i class="fa fa-terminal"></i>&nbsp;&nbsp;Sessions</h2>

  <div v-for="item in sessions" key="item.uuid" class="session-configuration card">
    <h3>{{ item.name }}</h3>
    <button class="delete_button" v-on:click="deleteSession(item.uuid)"><i class="fa fa-times"></i></button>
    <div>
      <component
        v-bind:is="sessionEditor(item.type)"
        v-bind:sessionConfiguration.prop="item"
        v-on:change="handleChange">
      </component>
    </div>
  </div>

  <div v-for="item in sessionTypes" key="item.uuid">
    <button class="btn btn-default" v-on:click="newSession(item.type)">New {{ item.name }} session</button>
  </div>
</div>
`
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
    let i = 0;
    for (const session of this.sessions) {
      if (session.uuid === uuid) {
        this.sessions.splice(i, 1);
      }
      i++;
    }
  }
}
