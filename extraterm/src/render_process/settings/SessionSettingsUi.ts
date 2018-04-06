/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { SessionConfiguration } from 'extraterm-extension-api';
import * as _ from 'lodash';

import { ExtensionManager } from '../extension/InternalTypes';


@Component(
  {
    template: `
<div>
  <h2><i class="fa fa-terminal"></i>&nbsp;&nbsp;Sessions</h2>

  <div v-for="item in sessions" key="item.uuid" class="session-configuration panel panel-default">
    <div class="panel-heading"><h3 class="panel-title">{{ item.name }}</h3>
    <button class="delete_button" v-on:click="deleteSession(item.uuid)">X</button></div>
    <div class="panel-body">
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
    const newSession: SessionConfiguration = { uuid: createUUID(), name: "new " + type, type};
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

function createUUID(): string {
  const buffer = new Uint8Array(16);
  window.crypto.getRandomValues(buffer);

  buffer[6] = (buffer[6] & 0x0f) | 0x40;
  buffer[8] = (buffer[8] & 0x3f) | 0x80;

  return byteToHex(buffer[0]) + byteToHex(buffer[1]) +
    byteToHex(buffer[2]) + byteToHex(buffer[3]) +
    "-" + byteToHex(buffer[4]) + byteToHex(buffer[5]) +
    "-" + byteToHex(buffer[6]) + byteToHex(buffer[7]) +
    "-" + byteToHex(buffer[8]) + byteToHex(buffer[9]) +
    "-" + byteToHex(buffer[10]) + byteToHex(buffer[11]) +
    byteToHex(buffer[12]) + byteToHex(buffer[13]) +
    byteToHex(buffer[14]) + byteToHex(buffer[15]);
}

function byteToHex(b: number): string {
  return (b + 0x100).toString(16).substr(1);
}
