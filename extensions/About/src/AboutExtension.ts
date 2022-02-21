/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionContext, ExtensionTab, Logger } from '@extraterm/extraterm-extension-api';
import { QLabel, TextFormat } from '@nodegui/nodegui';

let log: Logger = null;
let context: ExtensionContext = null;

export function activate(_context: ExtensionContext): any {
  log = _context.logger;
  context = _context;

  context.commands.registerCommand("about:about", aboutCommand);
}

let aboutTab: ExtensionTab = null;

function aboutCommand(): void {
  if (aboutTab != null) {
    aboutTab.open();
    return;
  }

  aboutTab = context.activeWindow.createExtensionTab("about");
  aboutTab.title = "About";
  aboutTab.icon = "fa-lightbulb";

  const contents = new QLabel();
  contents.setTextFormat(TextFormat.RichText);
  contents.setWordWrap(true);
  contents.setOpenExternalLinks(true);
  contents.setText(
  `<style>
  #logo {
    float: left;
  }
  </style>
  <img id="logo" src="${context.extensionPath}/resources/extraterm_main_logo_512x367.png" width="512" height="367">
  <h1>Extraterm</h1>
  <h3>version ${context.application.version}</h3>
  <p>Copyright &copy; 2015-2022 Simon Edwards &lt;simon@simonzone.com&gt;</p>
  <p>Published under the MIT license</p>
  <p>See <a href="http://extraterm.org">extraterm.org</a> and <a href="https://github.com/sedwards2009/extraterm">https://github.com/sedwards2009/extraterm</a></p>
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

// function handleClick(ev: MouseEvent): void {
//   ev.preventDefault();
//   if ((<HTMLElement> ev.target).tagName === "A") {
//     const href = (<HTMLAnchorElement> ev.target).href;
//     context.application.openExternal(href);
//   }
// }
