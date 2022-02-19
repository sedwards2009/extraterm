/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { BlockFrame } from "../../terminal/BlockFrame";

import { TerminalBlock } from "../../terminal/TerminalBlock";
import { TerminalOutputDetailsImpl } from "./TerminalOutputDetailsImpl";
import { ExtensionMetadata } from "../ExtensionMetadata";

// import { ViewerElement } from "../viewers/ViewerElement";
// import { EmbeddedViewer } from "../viewers/EmbeddedViewer";
// import { TerminalViewer } from "../viewers/TerminalAceViewer";
// import { TextViewer } from"../viewers/TextAceViewer";
// import { TerminalOutputDetailsProxy } from "./proxy/TerminalOutputDetailsProxy";
// import { TextViewerDetailsProxy } from "./proxy/TextViewerDetailsProxy";
// import * as DomUtils from "../DomUtils";
// import { EtTerminal } from "../Terminal";
// import { EtViewerTab } from "../ViewerTab";


export class BlockImpl implements ExtensionApi.Block {

  #type: string = null;
  #details: any = null;
  #extensionMetadata: ExtensionMetadata;
  #blockFrame: BlockFrame = null;

  constructor(extensionMetadata: ExtensionMetadata, blockFrame: BlockFrame) {
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

    // let insideViewer = this._viewer;
    // if (this._viewer instanceof EmbeddedViewer) {
    //   insideViewer = this._viewer.getViewerElement();
    // }

    // if (insideViewer instanceof TerminalViewer) {
    //   this._details = new TerminalOutputDetailsProxy(this._internalExtensionContext, insideViewer);
    //   this._type = ExtensionApi.TerminalOutputType;
    // } else if (insideViewer instanceof TextViewer) {
    //   this._details = new TextViewerDetailsProxy(this._internalExtensionContext, insideViewer);
    //   this._type = ExtensionApi.TextViewerType;
    // } else {
    //   this._type = "unknown";
    // }
  }

  get type(): string {
    this.#init();
    return this.#type;
  }

  get details(): any {
    this.#init();
    return this.#details;
  }

  get tab(): ExtensionApi.Tab {
    // const terminal = this._getOwningEtTerminal();
    // if (terminal != null) {
    //   return this._internalExtensionContext._proxyFactory.getTabProxy(terminal);
    // }
    // const viewerTab = this._getOwningEtViewerTab();
    // if (viewerTab != null) {
    //   return this._internalExtensionContext._proxyFactory.getTabProxy(viewerTab);
    // }
    return null;
  }

  // private _getOwningEtTerminal(): EtTerminal {
  //   const path = DomUtils.nodePathToRoot(this._viewer);
  //   for (const node of path) {
  //     if (node instanceof EtTerminal) {
  //       return node;
  //     }
  //   }
  //   return null;
  // }

  // private _getOwningEtViewerTab(): EtViewerTab {
  //   const path = DomUtils.nodePathToRoot(this._viewer);
  //   for (const node of path) {
  //     if (node instanceof EtViewerTab) {
  //       return node;
  //     }
  //   }
  //   return null;
  // }
}
