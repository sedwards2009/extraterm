/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionContext, ExtensionTab, Logger } from '@extraterm/extraterm-extension-api';
import { AlignmentFlag, QLabel, TextFormat } from '@nodegui/nodegui';

let log: Logger = null;
let context: ExtensionContext = null;

export function activate(_context: ExtensionContext): any {
  log = _context.logger;
  context = _context;

  context.commands.registerCommand("about:about", aboutCommand);
}

let aboutTab: ExtensionTab = null;

async function aboutCommand(): Promise<void> {
  if (aboutTab != null) {
    aboutTab.open();
    return;
  }

  aboutTab = context.activeWindow.createExtensionTab("about");
  aboutTab.title = "About";
  aboutTab.icon = "fa-lightbulb";

  const contents = new QLabel();
  contents.setAlignment(AlignmentFlag.AlignTop | AlignmentFlag.AlignLeft);
  contents.setTextFormat(TextFormat.RichText);
  contents.setWordWrap(true);
  contents.setOpenExternalLinks(true);

  const isHiDPI = context.activeWindow.style.dpi >= 144;
  const imageFilename = isHiDPI ? "extraterm_main_logo_532x397.png" : "extraterm_main_logo_266x193.png";
  const imageWidth = isHiDPI ? 532 : 266;

  contents.setText(
  `${context.activeWindow.style.htmlStyleTag}
  <style>
  #logo {
    float: left;
  }
  </style>
  <img id="logo" src="${context.extensionPath}/resources/${imageFilename}" width="${imageWidth}">
  <h1>Extraterm</h1>
  <h3>version ${context.application.version}</h3>
  <p>Copyright &copy; 2015-2025 Simon Edwards &lt;simon@simonzone.com&gt;</p>
  <p>Published under the MIT license</p>
  <p>See <a href="https://extraterm.org">extraterm.org</a> and <a href="https://github.com/sedwards2009/extraterm">https://github.com/sedwards2009/extraterm</a></p>
  <hr>
  <p>Extraterm logos were designed and provided by <a href="https://github.com/g-harel">Gabriel Harel (https://github.com/g-harel)</a>.</p>
  <p>This software uses Twemoji for color emoji under the Creative Commons Attribution 4.0 International (CC BY 4.0) license. <a href="https://twemoji.twitter.com/">https://twemoji.twitter.com/</a></p>

`);

  aboutTab.contentWidget = contents;

  aboutTab.onDidClose(() => {
    aboutTab = null;
  });
  aboutTab.open();
}
