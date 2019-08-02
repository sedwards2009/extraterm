/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { ConfigDatabase } from '../../Config';
import * as ThemeTypes from '../../theme/Theme';
import { APPEARANCE_SETTINGS_TAG } from './AppearanceSettings';
import { FRAME_SETTINGS_TAG } from './FrameSettings';
import { GENERAL_SETTINGS_TAG} from './GeneralSettings';
import { KEY_BINDINGS_SETTINGS_TAG } from './keybindings/KeybindingsSettings';
import { SESSION_SETTINGS_TAG } from './SessionSettings';
import { KeybindingsManager } from '../keybindings/KeyBindingsManager';
import { doLater } from 'extraterm-later';
import { ExtensionManager } from '../extension/InternalTypes';
import { VUE_TEXT_ACE_VIEWER_ELEMENT_TAG } from './VueTextAceViewerElement';
import { VUE_TERMINAL_ACE_VIEWER_ELEMENT_TAG } from './VueTerminalAceViewerElement';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { TerminalVisualConfig } from '../TerminalVisualConfig';


for (const el of [
    GENERAL_SETTINGS_TAG,
    APPEARANCE_SETTINGS_TAG,
    FRAME_SETTINGS_TAG,
    KEY_BINDINGS_SETTINGS_TAG,
    SESSION_SETTINGS_TAG,
    VUE_TEXT_ACE_VIEWER_ELEMENT_TAG,
    VUE_TERMINAL_ACE_VIEWER_ELEMENT_TAG
  ]) {
  if (Vue.config.ignoredElements.indexOf(el) === -1) {
    Vue.config.ignoredElements.push(el);
  }
}

type MenuItemId = "general" | "appearance" | "frame" | "keybindings" | "session";

interface MenuItem {
  id: MenuItemId;
  icon: string;
  title: string;
}


@Component(
  {
    template: trimBetweenTags(`
<div id="settings_top">
  <div id="settings_menu">
    <ul>
      <li v-for="item in menuItems"
        :key="item.id"
        v-bind:class="{active: item.id == selectedTab}"
        v-on:click="selectMenuTab(item.id)">
        <i v-bind:class="formatIcon(item.icon)"></i>&nbsp;&nbsp;{{ item.title }}
      </li>
    </ul>
  </div>

  <div id="settings_pane">
    <template v-if="firstShowComplete || selectedTab == 'general'">
      <et-general-settings v-show="selectedTab == 'general'"
        v-bind:configDatabase.prop="getConfigDatabase()">
      </et-general-settings>
    </template>

    <template v-if="firstShowComplete || selectedTab == 'appearance'">
      <et-appearance-settings v-show="selectedTab == 'appearance'"
        v-bind:configDatabase.prop="getConfigDatabase()"
        v-bind:themes.prop="themes"
        v-bind:extensionManager.prop="getExtensionManager()"
        v-bind:terminalVisualConfig.prop="getTerminalVisualConfig()">
      </et-appearance-settings>
    </template>

    <template v-if="firstShowComplete || selectedTab == 'session'">
      <et-session-settings v-show="selectedTab == 'session'"
        v-bind:configDatabase.prop="getConfigDatabase()"
        v-bind:extensionManager.prop="getExtensionManager()">
      </et-session-settings>
    </template>
    
    <template v-if="firstShowComplete || selectedTab == 'frame'">
      <et-frame-settings v-show="selectedTab == 'frame'"
        v-bind:configDatabase.prop="getConfigDatabase()">
      </et-frame-settings>
    </template>

    <template v-if="firstShowComplete || selectedTab == 'keybindings'">
      <et-key-bindings-settings v-show="selectedTab == 'keybindings'"
        v-bind:configDatabase.prop="getConfigDatabase()"
        v-bind:keybindingsManager.prop="getKeybindingsManager()"
        v-bind:extensionManager.prop="getExtensionManager()">
      </et-key-bindings-settings>
    </template>
  </div>
</div>
`)
})
export class SettingsUi extends Vue {
  private _configDatabase: ConfigDatabase = null;
  private _keybindingsManager: KeybindingsManager = null;
  private _extensionManager: ExtensionManager = null;
  private _terminalVisualConfig: TerminalVisualConfig = null;

  firstShowComplete: boolean;
  selectedTab: string;
  themes: ThemeTypes.ThemeInfo[];
  menuItems: MenuItem[];

  constructor() {
    super();
    this.firstShowComplete = false;
    this.selectedTab = "general";
    this.themes = [];
    this.menuItems = [
      { id: "general", icon: "fa fa-sliders-h", title: "General"},
      { id: "appearance", icon: "fa fa-paint-brush", title: "Appearance"},
      { id: "session", icon: "fa fa-terminal", title: "Session Types"},
      { id: "keybindings", icon: "far fa-keyboard", title: "Keybindings"},
      { id: "frame", icon: "far fa-window-maximize", title: "Frames"}
    ];
  }

  mounted(): void {
    if (this.firstShowComplete) {
      return;
    }

    doLater(() => {
      this.firstShowComplete = true;
    });
  }

  selectMenuTab(id: MenuItemId): void {
    this.selectedTab = id;
  }

  setConfigDatabase(configDatabase: ConfigDatabase) {
    this._configDatabase = configDatabase;
    this.$forceUpdate();
  }

  getConfigDatabase(): ConfigDatabase {
    return this._configDatabase;
  }

  setKeybindingsManager(newKeybindingsManager: KeybindingsManager): void {
    this._keybindingsManager = newKeybindingsManager;
    this.$forceUpdate();
  }

  getKeybindingsManager(): KeybindingsManager {
    return this._keybindingsManager;
  }
  
  setExtensionManager(extensionManager: ExtensionManager): void {
    this._extensionManager = extensionManager;
    this.$forceUpdate();
  }

  getExtensionManager(): ExtensionManager {
    return this._extensionManager;    
  }

  getTerminalVisualConfig(): TerminalVisualConfig {
    return this._terminalVisualConfig;
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this._terminalVisualConfig = terminalVisualConfig;
    this.$forceUpdate();
  }

  formatIcon(icon: string): object {
    return icon.split(" ").reduce( (accu, clazz) => {
      accu[clazz] = true;
      return accu;
    }, {});
  }
}
