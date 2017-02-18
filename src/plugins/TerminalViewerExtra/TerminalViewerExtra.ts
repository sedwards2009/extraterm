/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as PluginApi from '../../PluginApi';
import Logger from '../../Logger';

class TerminalViewerExtra implements PluginApi.ExtratermPlugin {

  private _log: Logger;

  constructor(api: PluginApi.ExtratermApi) {

    this._log = new Logger("TerminalViewerExtra", this);
    api.addNewTopLevelEventListener( (el: HTMLElement): void => {
      this._log.debug("Saw a new top level");
    });

    api.addNewTabEventListener( (el: HTMLElement): void => {
      this._log.debug("Saw a new tab level");
    });
  }

}

function factory(api: PluginApi.ExtratermApi): PluginApi.ExtratermPlugin {
  return new TerminalViewerExtra(api);
}
export = factory;
