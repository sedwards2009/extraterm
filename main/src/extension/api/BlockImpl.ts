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


export class BlockImpl implements ExtensionApi.Block {

  #internalExtensionContext: InternalExtensionContext;
  #type: string = null;
  #details: any = null;
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
      this.#details = new TerminalOutputDetailsImpl(this.#extensionMetadata, block);
      this.#type = ExtensionApi.TerminalOutputType;
    }
  }

  get type(): string {
    this.#init();
    return this.#type;
  }

  get details(): any {
    this.#init();
    return this.#details;
  }

  get terminal(): ExtensionApi.Terminal {
    return this.#internalExtensionContext.wrapTerminal(this.#blockFrame.getBlock().getParent());
  }
}
