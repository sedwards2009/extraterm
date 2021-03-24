/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface MainWindow {
  id: number;
  restore(): Promise<void>;
  ready(): Promise<void>;
}

export interface OpenWindowOptions {
  openDevTools?: boolean;
  bareWindow?: boolean;
}
