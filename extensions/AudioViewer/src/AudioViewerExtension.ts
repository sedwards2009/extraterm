/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {BulkFileHandle, CommandEntry, ExtensionContext, Logger, Terminal} from 'extraterm-extension-api';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;

  class TestViewer extends context.workspace.extensionViewerBaseConstructor {
    private _bulkFileHandle: BulkFileHandle = null;
    private _audioElement: HTMLAudioElement = null;

    created(): void {
      super.created();

      this._audioElement = <HTMLAudioElement> document.createElement("audio");
      this._audioElement.controls = true;

      this.getContainerElement().appendChild(this._audioElement);
      this._updateMetadata();
    }

    private _updateMetadata(): void {
      let title = "Audio Viewer";
      if (this._bulkFileHandle != null) {
        const filename = this._bulkFileHandle.getMetadata()["filename"];
        if (filename !== undefined) {
          title = <string> filename;
        }
      }

      this.updateMetadata({
        title,
        icon: "file-audio-o"
      });
    }

    getBulkFileHandle(): BulkFileHandle {
      return this._bulkFileHandle;
    }
  
    setBulkFileHandle(handle: BulkFileHandle): void {
      if (this._bulkFileHandle != null) {
        this._bulkFileHandle.deref();
        this._bulkFileHandle = null;
      }

      this._bulkFileHandle = handle;
      handle.ref();

      this._updateMetadata();
      this._audioElement.src = this._bulkFileHandle.getUrl();

    }
  }

  context.workspace.registerViewer("AudioViewer", TestViewer);
}

