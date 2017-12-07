/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import Vue from 'vue';
import Component from 'vue-class-component';

import {BulkFileHandle} from '../bulk_file_handling/BulkFileHandle';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import {SimpleViewerElement} from '../viewers/SimpleViewerElement';


const DEBUG_SIZE = false;

export const ID_CONTAINER = "ID_CONTAINER";

@Component(
{
  template: `<span>Download viewer</span>`
})
class DownloadUI extends Vue {

}

@WebComponent({tag: "et-download-viewer"})
export class DownloadViewer extends SimpleViewerElement {

  static TAG_NAME = "et-download-viewer";

  private _log: Logger;
  private _bulkFileHandle: BulkFileHandle;
  private _ui: DownloadUI = null;

  constructor() {
    super();
    this._log = getLogger("et-download-viewer", this);

    this._ui = new DownloadUI();
    const component = this._ui.$mount();
    this.getContainerNode().appendChild(component.$el);
  }

  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["application/octet-stream"].indexOf(mimeType) !== -1;
  }

  getTitle(): string {
    return "Download";
  }
  
  getAwesomeIcon(): string {
    return "download";
  }

  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): void {
    // this._loadBulkFile(handle);
  }
}
