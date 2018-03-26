/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import {FontInfo, CommandLineAction, ShowTipsStrEnum, ConfigDistributor} from '../../Config';
import * as ThemeTypes from '../../theme/Theme';
import { APPEARANCE_SETTINGS_TAG } from './AppearanceSettings';

const ID_SCROLLBACK = "ID_SCROLLBACK";
const ID_SETTINGS = "ID_SETTINGS";
const ID_SCROLLBACK_FRAMES = "ID_SCROLLBACK_FRAMES";
const ID_COMMAND_OUTPUT_HANDLING = "ID_COMMAND_OUTPUT_HANDLING";
const CLASS_DELETE = "CLASS_DELETE";
const CLASS_FRAME = "CLASS_FRAME";
const CLASS_MATCH = "CLASS_MATCH";
const CLASS_MATCH_TYPE = "CLASS_MATCH_TYPE";



export interface Identifiable {
  id?: string;
}

export interface IdentifiableCommandLineAction extends CommandLineAction, Identifiable {
}


let idCounter = 0;
export function nextId(): string {
  idCounter++;
  return "" + idCounter;
}

for (const el of [APPEARANCE_SETTINGS_TAG]) {
  if (Vue.config.ignoredElements.indexOf(el) === -1) {
    Vue.config.ignoredElements.push(el);
  }
}


@Component(
  {
    template: `
<div id='${ID_SETTINGS}'>
  <section>
    <et-appearance-settings
      v-bind:configDistributor.prop="getConfigDistributor()"
      v-bind:themes.prop="themes" >
      </et-appearance-settings>
  </section>
  <section>
    <h2>Settings</h2>
    <div className='settingsform'>
    
      <div class="form-horizontal">
        <div class="form-group">
          <label for="tips" class="col-sm-3 control-label">Show Tips:</label>
          <div class="input-group col-sm-4">
            <select class="form-control" id="tips" v-model="showTips">
              <option v-for="option in showTipsOptions" v-bind:value="option.id">
                {{ option.name }}
              </option>
            </select>
          </div>
        </div>
        

        <div class="form-group">
          <label for="${ID_SCROLLBACK}" class="col-sm-3 control-label">Maximum Scrollback Lines:</label>
          <div class="input-group col-sm-2">
            <input id="${ID_SCROLLBACK}" type="number" class="form-control" v-model.number="maxScrollbackLines" min="1"
              max="10000000" debounce="500" />
            <div class="input-group-addon">lines</div>
          </div>
        </div>

        <div class="form-group">
          <label for="${ID_SCROLLBACK_FRAMES}" class="col-sm-3 control-label">Maximum Scrollback Frames:</label>
          <div class="input-group col-sm-2">
            <input id="${ID_SCROLLBACK_FRAMES}" type="number" class="form-control" v-model.number="maxScrollbackFrames" min="1"
              max="1000" debounce="500" />
            <div class="input-group-addon">frames</div>
          </div>
        </div>
        
      </div>
    </div>
  </section>

  <section id='${ID_COMMAND_OUTPUT_HANDLING}'>
    <h2>Command Output Handling Rules</h2>
    <table class="table">
      <thead v-if="commandLineActions.length !== 0">
        <tr><th>Match</th><th>Command</th><th>Frame</th><th></th></tr>
      </thead>
      <tbody>
      <tr v-if="commandLineActions.length !== 0" v-for="commandLineAction in commandLineActions" track-by="id">
        <td class='${CLASS_MATCH_TYPE}'><select v-model="commandLineAction.matchType" class="form-control">
          <option value="name">Match command name</option>
          <option value="regexp">Match regular expression</option>
          </select></td>
        <td class='${CLASS_MATCH}'><input type="text" class="form-control" v-model="commandLineAction.match" debounce="500" /></td>
        <td class='${CLASS_FRAME}'>
          <div class="checkbox">
            <label>
              <input type="checkbox" v-model="commandLineAction.frame" />
              Show frame
            </label>
          </div>
        </td>
        <td class='${CLASS_DELETE}'><button @click="deleteCommandLineAction(commandLineAction.id);" class="btn btn-danger btn-sm">Delete</button></td>
      </tr>
      
      <tr>
        <td colspan="4">
          <button @click="addCommandLineAction" class="btn btn-default">New Rule</button>
        </td>
      </tr>
      </tbody>
    </table>
  </section>
</div>
`
})
export class SettingsUi extends Vue {
  private __configDistributor: ConfigDistributor = null;

  showTips: ShowTipsStrEnum;
  showTipsOptions:{ id: ShowTipsStrEnum, name: string; }[];
  
  maxScrollbackLines: number;
  maxScrollbackFrames: number;
  commandLineActions: IdentifiableCommandLineAction[];

  themes: ThemeTypes.ThemeInfo[];
  
  constructor() {
    super();
    this.themes = [];
    this.showTips = 'always';
    this.showTipsOptions = [ { id: 'always', name: 'Everytime' }, { id: 'daily', name: 'Daily'}, { id: 'never', name: 'Never'} ];
    this.maxScrollbackLines = 500000;
    this.maxScrollbackFrames = 100;
    this.commandLineActions = [];

  }

  addCommandLineAction(): void {
    const emptyAction: IdentifiableCommandLineAction = { match: "", matchType: 'name', frame: true, id: nextId() };
    this.commandLineActions.push(emptyAction);
  }

  deleteCommandLineAction(id: string): void {
    const index = this.commandLineActions.findIndex(cla => cla.id === id);
    if (index !== -1) {
      this.commandLineActions.splice(index, 1);
    }
  }

  setConfigDistributor(configDistributor: ConfigDistributor) {
    this.__configDistributor = configDistributor;
    this.$forceUpdate();
  }

  getConfigDistributor(): ConfigDistributor {
    return this.__configDistributor;
  }
}
