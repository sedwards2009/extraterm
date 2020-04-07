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
import { ExtensionCard } from './ExtensionCardUi';

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
  <div>
    <extension-card
      :extension="extension"
      :showDetailsButton="false"
    ></extension-card>

    <h3>Details</h3>
    FIXME Rendered markdown goes here.

    <h3>Feature Contributions</h3>

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
`)
  }
)
export class ExtensionDetails extends Vue {
  extension: ExtensionMetadataAndState;

  constructor() {
    super();
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
}
