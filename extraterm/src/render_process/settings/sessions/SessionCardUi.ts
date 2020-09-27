/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { ExtensionManager, SessionSettingsChange } from '../../extension/InternalTypes';
import { trimBetweenTags } from 'extraterm-trim-between-tags';


@Component({
  props: {
    extensionManager: Object,
    sessionConfiguration: Object,
    sessionType: String,
  },
  template: `<div ref="root">Extra session settings</div>`
})
class ExtraSessionSettings extends Vue {
  // Props
  extensionManager: ExtensionManager;
  sessionConfiguration: SessionConfiguration;
  sessionType: string;

  // Fields
  private _initialized = false;

  mounted(): void {
    this._setup();
  }

  private _setup(): void {
    if ( ! this._initialized) {
      this._initialized = true;
      const settingsEditors = this.extensionManager.createSessionSettingsEditors(this.sessionType,
        this.sessionConfiguration);
      for (const settingsEditor of settingsEditors) {
        settingsEditor.onSettingsChanged((changeEvent: SessionSettingsChange) => {
          this.$emit("settings-changed", changeEvent.settingsConfigKey, changeEvent.settings);
        });
        (<HTMLElement>this.$refs.root).appendChild(settingsEditor._getExtensionContainerElement());
      }
    }
  }
}


@Component({
  components: {
    "extra-settings": ExtraSessionSettings
  },
  props: {
    extensionManager: Object,
    isDefault: Boolean,
    sessionConfiguration: Object,
    uuid: String,
  },
  template: trimBetweenTags(`
<div class="session-configuration card">
  <h3 class="session-name no-user-select">{{ name }}</h3>
  <div class="session-type no-user-select">{{ typeName}}</div>

  <div class="session-card-buttons">
    <button v-if="! isDefault" class="microtool primary" v-on:click="$emit('make-default', uuid)" title="Make default"><i class="fas fa-angle-double-up"></i></button>
    <div v-if="isDefault" class="no-user-select"><em>default</em></div>
    <button v-if="! isDefault" class="microtool danger" v-on:click="$emit('delete-session', uuid)"><i class="fa fa-times"></i></button>
  </div>
  <div>
    <component
      v-bind:is="sessionEditor"
      v-bind:sessionConfiguration.prop="sessionConfiguration"
      v-on:change="handleChange"
    />
    <extra-settings
      v-bind:extensionManager="extensionManager"
      v-bind:sessionConfiguration="sessionConfiguration"
      v-bind:sessionType="sessionConfiguration.type"
      v-on:settings-changed="handleSettingsChanged"
    />
  </div>
</div>
`)
})
export class SessionCardUi extends Vue {
  extensionManager: ExtensionManager;
  sessionConfiguration: SessionConfiguration;
  uuid: string;
  isDefault: boolean;

  get name(): string {
    return this.sessionConfiguration.name;
  }

  get typeName(): string {
    if (this.extensionManager == null) {
      return "";
    }

    for (const sessionType of this.extensionManager.getAllSessionTypes()) {
      if (sessionType.type === this.sessionConfiguration.type) {
        return sessionType.name;
      }
    }
    return "";
  }

  get sessionEditor(): string {
    return this.extensionManager.getSessionEditorTagForType(this.sessionConfiguration.type);
  }

  handleChange(event: Event): void {
    const newSessionConfig = (<any>event.target).sessionConfiguration;
    this.$emit("change", newSessionConfig);
  }

  handleSettingsChanged(settingsConfigKey: string, settings: Object): void {
    this.$emit("settings-change", this.sessionConfiguration.uuid, settingsConfigKey, settings);
  }
}
