/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import { CustomElement } from 'extraterm-web-component-decorators';
import * as _ from 'lodash';

import { FrameSettingsUi, nextId, Identifiable, IdentifiableCommandLineAction} from './FrameSettingsUi';
import { COMMAND_LINE_ACTIONS_CONFIG, CommandLineAction, GENERAL_CONFIG, GeneralConfig } from '../../../Config';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";
import { SettingsBase } from '../SettingsBase';
import { ConfigKey } from "../../../ConfigDatabase";

export const FRAME_SETTINGS_TAG = "et-frame-settings";

@CustomElement(FRAME_SETTINGS_TAG)
export class FrameSettings extends SettingsBase<FrameSettingsUi> {
  private _log: Logger = null;

  constructor() {
    super(FrameSettingsUi);
    this._log = getLogger(FRAME_SETTINGS_TAG, this);
  }

  protected _setConfigInUi(key: ConfigKey, config: any): void {
    const ui = this._getUi();
    if (key === COMMAND_LINE_ACTIONS_CONFIG) {
      const commandLineActions = <CommandLineAction[]> config;

      const cleanCommandLineAction = _.cloneDeep(ui.commandLineActions);
      stripIds(cleanCommandLineAction);

      if ( ! _.isEqual(cleanCommandLineAction, commandLineActions)) {
        const updateCLA = <IdentifiableCommandLineAction[]> _.cloneDeep(commandLineActions);
        setIds(updateCLA);
        ui.commandLineActions = updateCLA;
      }
    }

    if (key === GENERAL_CONFIG) {
      const generalConfig = <GeneralConfig> config;
      ui.frameByDefault = generalConfig.frameByDefault ? "true" : "false";
      ui.frameRule = generalConfig.frameRule;
      ui.frameRuleLines = generalConfig.frameRuleLines;
    }
  }

  protected _dataChanged(): void {
    const ui = this._getUi();
    const commandLineActions = _.cloneDeep(ui.commandLineActions);
    stripIds(commandLineActions);
    this.configDatabase.setCommandLineActionConfig(commandLineActions);

    const generalConfig = this.configDatabase.getGeneralConfigCopy();
    generalConfig.frameByDefault = ui.frameByDefault === "true";
    generalConfig.frameRule = ui.frameRule;
    generalConfig.frameRuleLines = ui.frameRuleLines;
    this.configDatabase.setGeneralConfig(generalConfig);
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
