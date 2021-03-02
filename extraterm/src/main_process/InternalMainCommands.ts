/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Logger, getLogger } from "extraterm-logging";
import { MainExtensionManager } from "./extension/MainExtensionManager";
import { MainDesktop } from "./MainDesktop";

export function registerInternalCommands(extensionManager: MainExtensionManager, mainDesktop: MainDesktop): void {
  const internalMainCommands = new InternalMainCommands(mainDesktop);

  const commands = extensionManager.getExtensionContextByName("internal-main-commands").commands;
  commands.registerCommand("extraterm:window.listAll", internalMainCommands.commandWindowListAll);

}

class InternalMainCommands {
  private _log: Logger = null;

  #mainDesktop: MainDesktop = null;

  constructor(mainDesktop: MainDesktop) {
    this._log = getLogger("InternalMainCommands", this);
    this.#mainDesktop = mainDesktop;
    this.commandWindowListAll = this.commandWindowListAll.bind(this);
  }

  commandWindowListAll(): WindowDescription[] {
    const result: WindowDescription[] = [];
    for (const id of this.#mainDesktop.getAllWindowIds()) {
      result.push({
        id: "" + id
      });
    }
    return result;
  }
}

interface WindowDescription {
  id: string;
}
