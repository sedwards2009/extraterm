/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import {shell} from 'electron';
import * as fs from 'fs';
import * as marked from 'marked';
import * as dompurify from 'dompurify';

import { } from '../../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ExtensionMetadataAndState } from './ExtensionMetadataAndStateType';
import { ExtensionCard, EVENT_ENABLE_EXTENSION, EVENT_DISABLE_EXTENSION } from './ExtensionCardUi';

interface MenuPair {
  context: string;
  command: string;
}

@Component(
  {
    components: {
      "extension-card": ExtensionCard,
    },
    props: {
      extension: Object,
    },
    template: trimBetweenTags(`
  <div v-on:click.stop.prevent="onClick($event)">
    <extension-card
      :extension="extension"
      :showDetailsButton="false"
      v-on:enable-extension="onEnableExtension"
      v-on:disable-extension="onDisableExtension"
    ></extension-card>

    <p v-if="extension.metadata.homepage != null">
      <i class="fas fa-home"></i> Home page: <a :href="extension.metadata.homepage">{{extension.metadata.homepage}}</a>
    </p>

    <div class="gui-layout width-100pc cols-1-1">
      <h3 class="sub-tab" v-bind:class="{selected: subtab==='details'}" v-on:click.stop="subtab = 'details'">
        Details
      </h3>
      <h3 class="sub-tab" v-bind:class="{selected: subtab==='contributions'}" v-on:click.stop="subtab = 'contributions'">
        Feature Contributions
      </h3>
    </div>

    <div v-if="subtab === 'details'" v-html="readmeText">
    </div>

    <div v-if="subtab === 'contributions'">
      <template v-if="extension.metadata.contributes.commands.length !== 0">
        <h4>Commands</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Title</th>
              <th>Command</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="command in extension.metadata.contributes.commands">
              <td>{{ command.title }}</td>
              <td>{{ command.command }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.keybindings.length !== 0">
        <h4>Keybindings</h4>
        <table class="width-100pc">
          <thead>
            <tr>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="keybindings in extension.metadata.contributes.keybindings">
              <td>{{ keybindings.path }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="menus.length !== 0">
        <h4>Menus</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Context</th>
              <th>Command</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="menuPair in menus">
              <td>{{ menuPair.context }}</td>
              <td>{{ menuPair.command }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.sessionBackends.length !== 0">
        <h4>Session backends</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="backend in extension.metadata.contributes.sessionBackends">
              <td>{{ backend.name }}</td>
              <td>{{ backend.type }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.sessionEditors.length !== 0">
        <h4>Session editors</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sessionEditor in extension.metadata.contributes.sessionEditors">
              <td>{{ sessionEditor.name }}</td>
              <td>{{ sessionEditor.type }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.sessionSettings.length !== 0">
        <h4>Session settings</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sessionSettings in extension.metadata.contributes.sessionSettings">
              <td>{{ sessionSettings.name }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.syntaxThemes.length !== 0">
        <h4>Syntax themes</h4>
        <table class="width-100pc">
          <thead>
            <tr>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="syntaxTheme in extension.metadata.contributes.syntaxThemes">
              <td>{{ syntaxTheme.path }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.syntaxThemeProviders.length !== 0">
        <h4>Syntax theme providers</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Formats</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="syntaxThemeProvider in extension.metadata.contributes.syntaxThemeProviders">
              <td>{{ syntaxThemeProvider.name }}</td>
              <td>{{ syntaxThemeProvider.humanFormatNames.join(", ") }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.tabTitleWidgets.length !== 0">
        <h4>Tab title widgets</h4>
        <table class="width-100pc">
          <thead>
            <tr>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tabTitleWidget in extension.metadata.contributes.tabTitleWidgets">
              <td>{{ tabTitleWidget.name }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.terminalBorderWidgets.length !== 0">
        <h4>Terminal border widgets</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Border</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="terminalBorderWidget in extension.metadata.contributes.terminalBorderWidgets">
              <td>{{ terminalBorderWidget.name }}</td>
              <td>{{ terminalBorderWidget.border }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.terminalThemes.length !== 0">
        <h4>Terminal themes</h4>
        <table class="width-100pc">
          <thead>
            <tr>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="terminalTheme in extension.metadata.contributes.terminalThemes">
              <td>{{ terminalTheme.path }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.terminalThemeProviders.length !== 0">
        <h4>Terminal themes</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Formats</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="terminalThemeProvider in extension.metadata.contributes.terminalThemeProviders">
              <td>{{ terminalThemeProvider.name }}</td>
              <td>{{ terminalThemeProvider.humanFormatNames.join(", ") }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="extension.metadata.contributes.viewers.length !== 0">
        <h4>Viewers</h4>
        <table class="width-100pc cols-1-1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mime-types</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="viewer in extension.metadata.contributes.viewers">
              <td>{{ viewer.name }}</td>
              <td>{{ viewer.mimeTypes.join(", ") }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      </div>
    </div>
`)
  }
)
export class ExtensionDetails extends Vue {
  extension: ExtensionMetadataAndState;

  rawReadmeText: string = null;
  loadingReadmeText: boolean = false;
  subtab: 'details' | 'contributions' = 'details';

  constructor() {
    super();
  }

  get readmeText(): string {
    if (! this.loadingReadmeText) {
      if (this.extension.metadata.readmePath != null) {
        this.loadingReadmeText = true;
        fs.readFile(this.extension.metadata.readmePath, {encoding: "utf8"},
          (err: NodeJS.ErrnoException, data: string) => {
            if (err != null) {
              this.rawReadmeText = "<p>(Missing)</p>";
              return;
            }

            this.rawReadmeText = dompurify.sanitize(marked(data));
          });
      } else {
        this.rawReadmeText = "<p>(Missing)</p>";
      }
    }

    return this.rawReadmeText == null ? "" : this.rawReadmeText;
  }

  get menus(): MenuPair[] {
    const menus = this.extension.metadata.contributes.menus;
    return [
      ...menus.commandPalette.map(m => ({ context: "Command palette", command: m.command })),
      ...menus.contextMenu.map(m => ({ context: "Context menu", command: m.command })),
      ...menus.emptyPane.map(m => ({ context: "Empty pane", command: m.command })),
      ...menus.newTerminal.map(m => ({ context: "New terminal", command: m.command })),
      ...menus.terminalTab.map(m => ({ context: "Terminal tab", command: m.command })),
    ];
  }

  onClick(ev: MouseEvent): void {
    if ((<HTMLElement> ev.target).tagName === "A") {
      const href = (<HTMLAnchorElement> ev.target).href;
      shell.openExternal(href);
    }
  }

  onEnableExtension(extensionName: string): void {
    this.$emit(EVENT_ENABLE_EXTENSION, extensionName);
  }

  onDisableExtension(extensionName: string): void {
    this.$emit(EVENT_DISABLE_EXTENSION, extensionName);
  }
}
