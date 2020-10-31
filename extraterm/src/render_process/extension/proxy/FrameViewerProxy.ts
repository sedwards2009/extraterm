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
  }

  getContents(): ExtensionApi.Viewer {
    const viewerElement = this._embeddedViewer.getViewerElement();
    if (viewerElement !== null) {
      return this._internalExtensionContext.proxyFactory.getViewerProxy(viewerElement);
    }
    return null;
  }
}
