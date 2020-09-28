/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { ExtensionManager, SessionSettingsChange, InternalSessionSettingsEditor } from '../../extension/InternalTypes';
import { trimBetweenTags } from 'extraterm-trim-between-tags';


@Component({
  props: {
    internalSessionSettingsEditor: Object,
  },
  template: `<div ref="root"></div>`
})
class ExtraSessionSettings extends Vue {
  // Props
  internalSessionSettingsEditor: InternalSessionSettingsEditor;

  // Fields
  private _initialized = false;

  mounted(): void {
    this._setup();
  }

  private _setup(): void {
    if ( ! this._initialized) {
      this._initialized = true;

      this.internalSessionSettingsEditor.onSettingsChanged((changeEvent: SessionSettingsChange) => {
        this.$emit("settings-change", changeEvent.settingsConfigKey, changeEvent.settings);
      });
      (<HTMLElement>this.$refs.root).appendChild(this.internalSessionSettingsEditor._getExtensionContainerElement());
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

    <div
      v-for="(editor, index) in sessionSettingsEditors"
      v-bind:key="index"
      class="gui-layout width-100pc cols-1-1"
    >
      <h3
        class="sub-tab"
        v-bind:class="{selected: selectedSettings === index}"
        v-on:click.stop="selectedSettings = index"
      >
        {{ editor.name }}
      </h3>
    </div>

    <extra-settings
      v-for="(editor, index) in sessionSettingsEditors"
      v-if="index === selectedSettings"
      v-bind:key="uuid + index"
      v-bind:internalSessionSettingsEditor="editor"
      v-on:settings-change="handleSettingsChanged"
    />
  </div>
</div>
`)
})
export class SessionCardUi extends Vue {
  // Props
  extensionManager: ExtensionManager;
  sessionConfiguration: SessionConfiguration;
  uuid: string;
  isDefault: boolean;

  // Fields
  selectedSettings = 0;

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

  get sessionSettingsEditors(): InternalSessionSettingsEditor[] {
    return this.extensionManager.createSessionSettingsEditors(this.sessionConfiguration.type,
      this.sessionConfiguration);
  }
}
