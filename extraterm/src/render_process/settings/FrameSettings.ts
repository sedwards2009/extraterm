/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { FrameSettingsUi, nextId, Identifiable, IdentifiableCommandLineAction} from './FrameSettingsUi';
import { COMMAND_LINE_ACTIONS_CONFIG, ConfigKey, CommandLineAction } from '../../Config';
import { Logger, getLogger } from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';

export const FRAME_SETTINGS_TAG = "et-frame-settings";

@WebComponent({tag: FRAME_SETTINGS_TAG})
export class FrameSettings extends SettingsBase<FrameSettingsUi> {
  private _log: Logger = null;

  constructor() {
    super(FrameSettingsUi, [COMMAND_LINE_ACTIONS_CONFIG]);
    this._log = getLogger(FRAME_SETTINGS_TAG, this);
  }

  protected _setConfig(key: ConfigKey, config: any): void {
    if (key === COMMAND_LINE_ACTIONS_CONFIG) {
      const ui = this._getUi();
      const commandLineActions = <CommandLineAction[]> config;

      const cleanCommandLineAction = _.cloneDeep(ui.commandLineActions);
      stripIds(cleanCommandLineAction);

      if ( ! _.isEqual(cleanCommandLineAction, commandLineActions)) {
        const updateCLA = <IdentifiableCommandLineAction[]> _.cloneDeep(commandLineActions);
        setIds(updateCLA);
        ui.commandLineActions = updateCLA;
      }
    }
  }

  protected _dataChanged(): void {
    const ui = this._getUi();
    const commandLineActions = _.cloneDeep(ui.commandLineActions);
    stripIds(commandLineActions);
    this._updateConfig(COMMAND_LINE_ACTIONS_CONFIG, commandLineActions);
  }
}

function setIds(list: Identifiable[]): void {
  list.forEach( (idable) => {
    if (idable.id === undefined) {
      idable.id = nextId();
    }
  });
}

function stripIds(list: Identifiable[]): void {
  list.forEach( (idable) => {
    if (idable.id !== undefined) {
      delete idable.id;
    }
  });  
}
