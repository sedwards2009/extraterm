/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {WebComponent} from 'extraterm-web-component-decorators';
import * as ThemeTypes from '../theme/Theme';
import {FileTransferProgress} from './gui/file_transfer/FileTransferProgress';
import { doLater } from '../utils/DoLater';


@WebComponent({tag: "et-upload-progress-bar"})
export class UploadProgressBar extends FileTransferProgress {
  
  static TAG_NAME = "ET-UPLOAD-PROGRESS-BAR";

  connectedCallback(): void {
    super.connectedCallback();
    this.actionType = "upload";
  }

  hide(): void {
    this.getContainerNode().classList.add("upload_hide");
  }

  show(delayMs=0): void {
    if (delayMs === 0) {
      this.getContainerNode().classList.remove("upload_hide");
    } else {
      doLater(() => {
        this.getContainerNode().classList.remove("upload_hide");
        }, delayMs);
    }
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    const types = super._themeCssFiles();
    types.push(ThemeTypes.CssFile.UPLOAD_PROGRESS_BAR);
    return types;
  }
}
