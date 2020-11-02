/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { AbstractViewerProxy } from "./AbstractViewerProxy";
import { EmbeddedViewer } from "../../viewers/EmbeddedViewer";
import { InternalExtensionContext } from "../InternalTypes";


export class FrameViewerProxy extends AbstractViewerProxy implements ExtensionApi.FrameViewer {

  viewerType: "frame" = "frame";

  constructor(internalExtensionContext: InternalExtensionContext, private _embeddedViewer: EmbeddedViewer) {
    super(internalExtensionContext, _embeddedViewer);
    this._embeddedViewer.onDispose(this._handleEmbeddedViewerDispose.bind(this));
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive()) {
      throw new Error("FrameViewer is not alive and can no longer be used.");
    }
  }

  private _handleEmbeddedViewerDispose(): void {
    this._embeddedViewer = null;
  }

  isAlive(): boolean {
    return this._embeddedViewer != null;
  }

  getContents(): ExtensionApi.Viewer {
    this._checkIsAlive();
    const viewerElement = this._embeddedViewer.getViewerElement();
    if (viewerElement !== null) {
      return this._internalExtensionContext._proxyFactory.getViewerProxy(viewerElement);
    }
    return null;
  }
}
