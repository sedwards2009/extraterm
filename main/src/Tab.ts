/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";

export interface Tab {
  getIconName(): string;
  getTitle(): string;
  getContents(): QWidget;
  getTabWidget(): QWidget;
  setIsCurrent(isCurrent: boolean): void;
  focus(): void;
  unfocus(): void;
}
