/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, QLabel, TextFormat, TextInteractionFlag } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface LabelOptions extends WidgetOptions {
  alignment?: AlignmentFlag;
  text?: string;
  textFormat?: TextFormat;
  wordWrap?: boolean;
  onLinkActivated?: (url: string) => void;
  openExternalLinks?: boolean;
  textInteractionFlag?: TextInteractionFlag;
}

export function Label(options: LabelOptions): QLabel {
  const label = new QLabel();

  ApplyWidgetOptions(label, options);
  const { alignment, onLinkActivated, openExternalLinks, text, textFormat, textInteractionFlag, wordWrap } = options;
  if (textFormat !== undefined) {
    label.setTextFormat(textFormat);
  }
  if (text !== undefined) {
    label.setText(text);
  }
  if (alignment !== undefined) {
    label.setAlignment(alignment);
  }
  if (wordWrap !== undefined) {
    label.setWordWrap(wordWrap);
  }
  if (onLinkActivated !== undefined) {
    label.addEventListener("linkActivated", onLinkActivated);
  }
  if (openExternalLinks !== undefined) {
    label.setOpenExternalLinks(openExternalLinks);
  }
  if (textInteractionFlag !== undefined) {
    label.setTextInteractionFlags(textInteractionFlag);
  }
  return label;
}
