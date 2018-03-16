/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {BulkFileHandle, CommandEntry, ExtensionContext, Logger, Terminal} from 'extraterm-extension-api';
import {AudioViewerUi} from './AudioViewerUi';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;

  class AudioViewer extends context.workspace.extensionViewerBaseConstructor {
    private _bulkFileHandle: BulkFileHandle = null;
    private _audioElement: HTMLAudioElement = null;
    private _ui: AudioViewerUi = null;

    created(): void {
      super.created();

      this._ui = new AudioViewerUi();
      const component = this._ui.$mount();
      this.getContainerElement().appendChild(component.$el);
  
      this._updateMetadata();
    }

    private _updateMetadata(): void {
      this.updateMetadata({
        title: this._getTitle(),
        icon: "file-audio-o"
      });
    }

    private _getTitle(): string {
      let title = "Audio Viewer";
      if (this._bulkFileHandle != null) {
        const filename = this._bulkFileHandle.getMetadata()["filename"];
        if (filename !== undefined) {
          title = <string> filename;
        }
      }
      return title;
    }

    getBulkFileHandle(): BulkFileHandle {
      return this._bulkFileHandle;
    }
  
    setBulkFileHandle(handle: BulkFileHandle): void {
      if (this._bulkFileHandle != null) {
        this._ui.url = null;
        this._bulkFileHandle.deref();
        this._bulkFileHandle = null;
      }

      this._bulkFileHandle = handle;
      handle.ref();

      this._updateMetadata();
      this._ui.url = this._bulkFileHandle.getUrl();
      this._ui.title = this._getTitle();
    }
  }

  context.workspace.registerViewer("AudioViewer", AudioViewer);
}
