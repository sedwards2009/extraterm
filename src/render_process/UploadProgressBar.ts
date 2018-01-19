/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';
import {ThemeableElementBase} from './ThemeableElementBase';
import * as ThemeTypes from '../theme/Theme';
import {FileTransferProgress} from './gui/FileTransferProgress';
import {SimpleElementBase} from './gui/SimpleElementBase';


@WebComponent({tag: "et-upload-progress-bar"})
export class UploadProgressBar extends SimpleElementBase {
  
  static TAG_NAME = "ET-UPLOAD-PROGRESS-BAR";

  private _fileTransferProgress: FileTransferProgress = null;

  constructor() {
    super();
    this._fileTransferProgress = <FileTransferProgress> document.createElement(FileTransferProgress.TAG_NAME);
    this._fileTransferProgress.actionType = "upload";
    this.getContainerNode().appendChild(this._fileTransferProgress);
  }

  @Attribute({default: null}) public transferred: number;

  @Observe("transferred") private _updateTransferred(): void {
    this._fileTransferProgress.transferred = this.transferred;
  }

  @Attribute({default: null}) public total: number;

  @Observe("total") private _updateTotal(): void {
    this._fileTransferProgress.total = this.total;
  }
  
  @Attribute({default: ""}) public filename: string;

  @Observe("filename") private _updateFilename(): void {
    this._fileTransferProgress.filename = this.filename;
  }
}
