/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface MainWindow {
  id: number;
  webContentsId: number;
  isMinimized(): boolean;
  isVisible(): boolean;
  moveTop(): void;
  restore(): Promise<void>;

  /**
   * Wait until the window is fully initialised and ready.
   */
  ready(): Promise<void>;
}

export interface OpenWindowOptions {
  openDevTools?: boolean;
  bareWindow?: boolean;
}
