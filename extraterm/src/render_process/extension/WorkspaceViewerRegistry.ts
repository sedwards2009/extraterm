/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

import { ExtensionViewerContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext } from './InternalTypes';
import { Logger, getLogger } from "extraterm-logging";
import { SimpleViewerElement } from '../viewers/SimpleViewerElement';
import { CssFile } from '../../theme/Theme';
import { ViewerElement } from '../viewers/ViewerElement';


interface RegisteredViewer {
  tag: string;
  mimeTypes: string[];
}

export class WorkspaceViewerRegistry {
  private _log: Logger = null;
  private _registeredViewers: RegisteredViewer[] = [];

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceViewerRegistry", this);
  }

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor): void {
    let viewerMetadata: ExtensionViewerContribution = null;
    for (const vmd of this._internalExtensionContext.extensionMetadata.contributes.viewers) {
      if (vmd.name === name) {
        viewerMetadata = vmd;
        break;
      }
    }

    if (viewerMetadata == null) {
      this._log.warn(`Unable to register viewer '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the viewer contribution data couldn't ` +
        `be found in the extension's package.json file.`);
      return;
    }

    const internalExtensionContext = this._internalExtensionContext;

    const viewerElementProxyClass = class extends ExtensionViewerProxy {
      protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
        return new viewerClass(this);
      }

      protected _getExtensionContext(): InternalExtensionContext {
        return internalExtensionContext;
      }
    
      protected _getExtensionViewerContribution(): ExtensionViewerContribution {
        return viewerMetadata;
      }
    };
    
// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-" + kebabCase(name);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, viewerElementProxyClass);

    this._registeredViewers.push({
      mimeTypes: viewerMetadata.mimeTypes, tag
    });
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    for (const registeredViewer of this._registeredViewers) {
      if (registeredViewer.mimeTypes.indexOf(mimeType) !== -1) {
        return registeredViewer.tag;
      }
    }
    return null;
  }
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}

class ExtensionViewerProxy extends SimpleViewerElement {
  private _extensionViewer: ExtensionApi.ExtensionViewerBase = null;

  constructor() {
    super();
    this._extensionViewer = this._createExtensionViewer();
    this._extensionViewer.created();
  }

  protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
    return null;
  }

  protected _getExtensionContext(): InternalExtensionContext {
    return null;
  }

  protected _getExtensionViewerContribution(): ExtensionViewerContribution {
    return null;
  }

  protected _themeCssFiles(): CssFile[] {
    const extensionContext = this._getExtensionContext();
    const name = extensionContext.extensionMetadata.name;
    const cssDecl = this._getExtensionViewerContribution().css;
    const cssFiles = cssDecl.cssFile.map(cf =>  name + ":" + cf);

    const fontAwesomeCss = cssDecl.fontAwesome ? [CssFile.FONT_AWESOME] : [];
    return [CssFile.GENERAL_GUI, ...fontAwesomeCss, ...cssFiles];
  }

  getMetadata(): ExtensionApi.ViewerMetadata {
    return this._extensionViewer.getMetadata();
  }
  
  _metadataUpdated(): void {
    const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }

  getBulkFileHandle(): ExtensionApi.BulkFileHandle {
    return this._extensionViewer.getBulkFileHandle();
  }

  setBulkFileHandle(handle: ExtensionApi.BulkFileHandle): Promise<void> {
    return this._extensionViewer.setBulkFileHandle(handle);
  }
}


export class ExtensionViewerBaseImpl implements ExtensionApi.ExtensionViewerBase {

  private __ExtensionViewerBaseImpl_metadata: ExtensionApi.ViewerMetadata = null;

  constructor(private _viewerProxy: ExtensionViewerProxy, ..._: any[]) {
    this.__ExtensionViewerBaseImpl_metadata = {
      title: "ExtensionViewer",
      deleteable: true,
      moveable: true,
      icon: null,
      posture: ExtensionApi.ViewerPosture.NEUTRAL,
      toolTip: null
    };
  }

  created(): void {
  }

  getContainerElement(): HTMLElement {
    return this._viewerProxy.getContainerNode();
  }

  getMetadata(): ExtensionApi.ViewerMetadata {
    return this.__ExtensionViewerBaseImpl_metadata;
  }
  
  updateMetadata(changes: ExtensionApi.ViewerMetadataChange): void {
    let changed = false;
    for (const key of Object.getOwnPropertyNames(changes)) {
      if (this.__ExtensionViewerBaseImpl_metadata[key] !== changes[key]) {
        this.__ExtensionViewerBaseImpl_metadata[key] = changes[key];
        changed = true;
      }
    }

    if (changed) {
      this._viewerProxy._metadataUpdated();
    }
  }

  getBulkFileHandle(): ExtensionApi.BulkFileHandle {
    return null;
  }

  setBulkFileHandle(handle: ExtensionApi.BulkFileHandle): Promise<void> {
    throw "Not implemented";
  }
}
