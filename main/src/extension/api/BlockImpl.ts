/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { BlockFrame } from "../../terminal/BlockFrame.js";

import { TerminalBlock } from "../../terminal/TerminalBlock.js";
import { TerminalOutputDetailsImpl } from "./TerminalOutputDetailsImpl.js";
import { ExtensionMetadata } from "../ExtensionMetadata.js";
import { InternalExtensionContext } from "../../InternalTypes.js";
import { ExtensionBlockImpl } from "./ExtensionBlockImpl.js";


export class BlockImpl implements ExtensionApi.Block {

  #internalExtensionContext: InternalExtensionContext;
  #type: string = null;

  #terminalOutputDetailsImpl: TerminalOutputDetailsImpl = null;

  #extensionMetadata: ExtensionMetadata;
  #blockFrame: BlockFrame = null;

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata,
      blockFrame: BlockFrame) {
    this.#internalExtensionContext = internalExtensionContext;
    this.#extensionMetadata = extensionMetadata;
    this.#blockFrame = blockFrame;
  }

  #init(): void {
    if (this.#type != null) {
      return;
    }

    const block = this.#blockFrame.getBlock();
    if (block instanceof TerminalBlock) {
      this.#terminalOutputDetailsImpl = new TerminalOutputDetailsImpl(this.#extensionMetadata, block);
      this.#type = ExtensionApi.TerminalOutputType;
    } else if (block instanceof ExtensionBlockImpl) {
      this.#type = block.getBlockTypeName();      
    }
  }

  get type(): string {
    this.#init();
    return this.#type;
  }

  get details(): any {
    this.#init();
    if (this.#terminalOutputDetailsImpl != null) {
      return this.#terminalOutputDetailsImpl;
    }

    const block = this.#blockFrame.getBlock();
    if (block instanceof ExtensionBlockImpl) {
      return block.getDetails();
    }
    return null;
  }

  get terminal(): ExtensionApi.Terminal {
    return this.#internalExtensionContext.wrapTerminal(this.#blockFrame.getBlock().getParent());
  }
}
