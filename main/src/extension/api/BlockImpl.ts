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
import { DecoratedFrame } from "../../terminal/DecoratedFrame.js";
import { QPoint } from "@nodegui/nodegui";


export class BlockImpl implements ExtensionApi.Block, ExtensionApi.Disposable {

  #internalExtensionContext: InternalExtensionContext;
  #type: string = null;

  #terminalOutputDetailsImpl: TerminalOutputDetailsImpl = null;

  #extensionMetadata: ExtensionMetadata;
  #blockFrame: BlockFrame = null;
  geometry: ExtensionApi.BlockGeometry;

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata,
      blockFrame: BlockFrame) {
    this.#internalExtensionContext = internalExtensionContext;
    this.#extensionMetadata = extensionMetadata;
    this.#blockFrame = blockFrame;
    this.geometry = new BlockGeometryImpl(blockFrame);
  }

  #init(): void {
    if (this.#type != null) {
      return;
    }

    const block = this.#blockFrame.getBlock();
    if (block instanceof TerminalBlock) {
      this.#terminalOutputDetailsImpl = new TerminalOutputDetailsImpl(this.#extensionMetadata, this.#blockFrame, block);
      this.#type = ExtensionApi.TerminalOutputType;
    } else if (block instanceof ExtensionBlockImpl) {
      this.#type = block.getBlockTypeName();
    }
  }

  dispose(): void {
    if (this.#terminalOutputDetailsImpl != null) {
      this.#terminalOutputDetailsImpl.dispose();
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

class BlockGeometryImpl implements ExtensionApi.BlockGeometry {
  #blockFrame: BlockFrame;

  constructor(blockFrame: BlockFrame) {
    this.#blockFrame = blockFrame;
  }

  get positionTop(): number {
    const geo = this.#blockFrame.getWidget().geometry();
    return geo.top();
  }

  get height(): number {
    const geo = this.#blockFrame.getWidget().geometry();
    return geo.height();
  }

  get titleBarHeight(): number {
    if (this.#blockFrame instanceof DecoratedFrame) {
      const parent = this.#blockFrame.getWidget();
      return this.#blockFrame.getBlock().getWidget().mapTo(parent, new QPoint(0, 0)).y();
    } else {
      return 0;
    }
  }
}
