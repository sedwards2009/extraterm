/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';

import { ExtensionSessionSettingsContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext } from './InternalTypes';
import { Logger, getLogger } from "extraterm-logging";
import { ThemeableElementBase } from '../ThemeableElementBase';
import { CssFile } from '../../theme/Theme';
import { log } from "extraterm-logging";
import { SessionSettingsEditorFactory, SessionSettingsEditorBase } from '@extraterm/extraterm-extension-api';


export class WorkspaceSessionSettingsRegistry {
  private _log: Logger = null;
  private _registeredSessionSettings = new Map<string, SessionSettingsEditorFactory>();

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceSessionSettingsRegistry", this);
  }

  registerSessionSettingsEditor(name: string, factory: SessionSettingsEditorFactory): void {
    let sessionSettingsMetadata: ExtensionSessionSettingsContribution = null;
    for (const ssm of this._internalExtensionContext.extensionMetadata.contributes.sessionSettings) {
      if (ssm.name === name) {
        sessionSettingsMetadata = ssm;
        break;
      }
    }

    if (sessionSettingsMetadata == null) {
      this._log.warn(`Unable to register session settings '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the session settings contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    this._registeredSessionSettings.set(sessionSettingsMetadata.name, factory);
  }
}
