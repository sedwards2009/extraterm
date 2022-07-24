/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Logger, getLogger } from "extraterm-logging";

import { ExtensionBlockContribution, ExtensionMetadata } from "./ExtensionMetadata.js";
import { Block } from "../terminal/Block.js";
import { BulkFile } from "../bulk_file_handling/BulkFile.js";
import { ExtensionBlockImpl } from "./api/ExtensionBlockImpl.js";
import { InternalExtensionContext } from "../InternalTypes.js";
import { Terminal } from "../terminal/Terminal.js";


export interface LoadedBlockContribution {
  blockMetadata: ExtensionBlockContribution;
  blockFactory: ExtensionApi.ExtensionBlockFactory;
}


export class BlockRegistry {
  private _log: Logger = null;

  #internalExtensionContext: InternalExtensionContext;
  #extensionMetadata: ExtensionMetadata;
  #blockTypes: LoadedBlockContribution[] = [];

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("BlockRegistry", this);
    this.#internalExtensionContext = internalExtensionContext;
    this.#extensionMetadata = extensionMetadata;
  }

  registerBlock(name: string, blockFactory: ExtensionApi.ExtensionBlockFactory): void {
    for (const blockMetadata of this.#extensionMetadata.contributes.blocks) {
      if (blockMetadata.name === name) {
        this.#blockTypes.push({
          blockMetadata: blockMetadata,
          blockFactory: blockFactory
        });
        return;
      }
    }

    this._log.warn(`Unable to register block '${name}' for extension ` +
      `'${this.#extensionMetadata.name}' because the block contribution data ` +
      `couldn't be found in the extension's package.json file.`);
  }

  createExtensionBlock(terminal: Terminal, name: string, bulkFile: BulkFile): Block {
    for (const lbc of this.#blockTypes) {
      if (lbc.blockMetadata.name === name) {
        const blockImpl = new ExtensionBlockImpl(this.#internalExtensionContext, bulkFile);
        blockImpl.setParent(terminal);
        lbc.blockFactory(blockImpl.getExtensionBlock());
        return blockImpl;
      }
    }

    this._log.warn(`Unable to find a registered block type '${name}' for extension ` +
      `'${this.#extensionMetadata.name}'. (Was it properly registered during extension start up?)`);

    return null;
  }
}
