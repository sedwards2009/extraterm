/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import { CustomElement } from 'extraterm-web-component-decorators';

import { GeneralSettingsUi } from './GeneralSettingsUi';
import { GeneralConfig, ConfigKey, GENERAL_CONFIG } from '../../Config';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";
import { SettingsBase } from './SettingsBase';

export const GENERAL_SETTINGS_TAG = "et-general-settings";

@CustomElement(GENERAL_SETTINGS_TAG)
export class GeneralSettings extends SettingsBase<GeneralSettingsUi> {
  private _log: Logger = null;

  constructor() {
    super(GeneralSettingsUi);
    this._log = getLogger(GENERAL_SETTINGS_TAG, this);
  }

  protected _setConfigInUi(key: ConfigKey, config: any): void {
    const ui = this._getUi();
    if (key === GENERAL_CONFIG) {
      const generalConfig = <GeneralConfig> config;

      if (ui.showTips !== generalConfig.showTips) {
        ui.showTips = generalConfig.showTips;
      }

      // We take care to only update things which have actually changed.
      if (ui.maxScrollbackLines !== generalConfig.scrollbackMaxLines) {
        ui.maxScrollbackLines = generalConfig.scrollbackMaxLines;
      }

      if (ui.maxScrollbackFrames !== generalConfig.scrollbackMaxFrames) {
        ui.maxScrollbackFrames = generalConfig.scrollbackMaxFrames;
      }
      if (ui.autoCopySelectionToClipboard !== generalConfig.autoCopySelectionToClipboard) {
        ui.autoCopySelectionToClipboard = generalConfig.autoCopySelectionToClipboard;
      }

      if ((ui.gpuDriverWorkaroundFlag ? "no_blend" : "none") !== generalConfig.gpuDriverWorkaround) {
        ui.gpuDriverWorkaroundFlag = generalConfig.gpuDriverWorkaround === "no_blend";
      }

      if (ui.closeWindowWhenEmpty !== generalConfig.closeWindowWhenEmpty) {
        ui.closeWindowWhenEmpty = generalConfig.closeWindowWhenEmpty;
      }

      if (ui.middleMouseButtonAction !== generalConfig.middleMouseButtonAction) {
        ui.middleMouseButtonAction = generalConfig.middleMouseButtonAction;
      }
      if (ui.middleMouseButtonShiftAction !== generalConfig.middleMouseButtonShiftAction) {
        ui.middleMouseButtonShiftAction = generalConfig.middleMouseButtonShiftAction;
      }
      if (ui.middleMouseButtonControlAction !== generalConfig.middleMouseButtonControlAction) {
        ui.middleMouseButtonControlAction = generalConfig.middleMouseButtonControlAction;
      }
      if (ui.rightMouseButtonAction !== generalConfig.rightMouseButtonAction) {
        ui.rightMouseButtonAction = generalConfig.rightMouseButtonAction;
      }
      if (ui.rightMouseButtonShiftAction !== generalConfig.rightMouseButtonShiftAction) {
        ui.rightMouseButtonShiftAction = generalConfig.rightMouseButtonShiftAction;
      }
      if (ui.rightMouseButtonControlAction !== generalConfig.rightMouseButtonControlAction) {
        ui.rightMouseButtonControlAction = generalConfig.rightMouseButtonControlAction;
      }
    }
  }

  protected _dataChanged(): void {
    const newGeneralConfig = this.configDatabase.getGeneralConfigCopy();
    const ui = this._getUi();

    newGeneralConfig.showTips = ui.showTips;
    newGeneralConfig.scrollbackMaxLines = ui.maxScrollbackLines;
    newGeneralConfig.scrollbackMaxFrames = ui.maxScrollbackFrames;
    newGeneralConfig.autoCopySelectionToClipboard = ui.autoCopySelectionToClipboard;
    newGeneralConfig.gpuDriverWorkaround = ui.gpuDriverWorkaroundFlag ? "no_blend" : "none";
    newGeneralConfig.closeWindowWhenEmpty = ui.closeWindowWhenEmpty;
    newGeneralConfig.middleMouseButtonAction = ui.middleMouseButtonAction;
    newGeneralConfig.middleMouseButtonShiftAction = ui.middleMouseButtonShiftAction;
    newGeneralConfig.middleMouseButtonControlAction = ui.middleMouseButtonControlAction;
    newGeneralConfig.rightMouseButtonAction = ui.rightMouseButtonAction;
    newGeneralConfig.rightMouseButtonShiftAction = ui.rightMouseButtonShiftAction;
    newGeneralConfig.rightMouseButtonControlAction = ui.rightMouseButtonControlAction;
    this.configDatabase.setGeneralConfig(newGeneralConfig);
  }
}
