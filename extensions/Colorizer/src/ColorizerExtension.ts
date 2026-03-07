/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  LineRangeChange,
  Screen,
  Terminal,
  TerminalOutputDetails,
  SettingsTab,
  STYLE_MASK_BOLD,
  STYLE_MASK_ITALIC,
  STYLE_MASK_UNDERLINE,
  UNDERLINE_STYLE_NORMAL
} from "@extraterm/extraterm-extension-api";
import { countCells } from "extraterm-unicode-utilities";
import escapeStringRegexp from "escape-string-regexp";

import { ColorizerSettingsPage } from "./ColorizerSettingsPage.js";
import { ColorRule, Config } from "./Config.js";

let log: Logger = null;
let context: ExtensionContext = null;

interface LiveColorRule extends ColorRule {
  matchRegexp: RegExp;
}

let config: Config = null;
let liveRules: LiveColorRule[] = [];

export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  for (const terminal of context.terminals.terminals) {
    terminal.onDidAppendScrollbackLines(scanAndColorScrollback);
    terminal.onDidScreenChange((ev: LineRangeChange) => {
      if ( ! config.enabled) {
        return;
      }
      scanAndColorScreen(terminal, ev);
    });
  }

  context.terminals.onDidCreateTerminal((newTerminal: Terminal) => {
    newTerminal.onDidAppendScrollbackLines(scanAndColorScrollback);
    newTerminal.onDidScreenChange((ev: LineRangeChange) => {
      if ( ! config.enabled) {
        return;
      }
      scanAndColorScreen(newTerminal, ev);
    });
  });

  context.settings.registerSettingsTab("colorizer-config", colorizerTab);

  loadConfig();
  liveRules = compileRules(config.rules);
}

function loadConfig(): void {
  config = context.configuration.get();
  if (config == null) {
    config = {
      enabled: true,
      rules: [
        {
          uuid: "bf6e8a72-dd09-4b5a-93f2-6ac93c4af16d",
          pattern: "(errors?)|(fail)|(critical)",
          foreground: 1,
          background: null,
          isCaseSensitive: false,
          isRegex: true,
          isBold: false,
          isItalic: false,
          isUnderline: false
        },
        {
          uuid: "2b10fb23-7853-479e-8ac5-7900c52ba33f",
          pattern: "warnings?",
          foreground: 11,
          background: null,
          isCaseSensitive: false,
          isRegex: true,
          isBold: false,
          isItalic: false,
          isUnderline: false
        }
      ]
    };
  }
}

function compileRules(rules: ColorRule[]): LiveColorRule[] {
  return rules.filter((rule: ColorRule) => rule.enabled !== false).map((rule: ColorRule): LiveColorRule => {
    const regexString = rule.isRegex ? rule.pattern : escapeStringRegexp(rule.pattern);

    try {
      const matchRegexp = new RegExp(regexString, rule.isCaseSensitive ? "g" : "gi");
      return {
        ...rule,
        matchRegexp
      };
    } catch(ex) {
      log.warn(`An error occurred while parsing regular expression '${regexString}'. ${ex}`);
      return null;
    }
  }).filter(r => r != null);
}

function scanAndColorScrollback(ev: LineRangeChange): void {
  const details = <TerminalOutputDetails> ev.block.details;
  scanAndColor(details.scrollback, ev);
}

function scanAndColorScreen(terminal: Terminal, ev: LineRangeChange): void {
  scanAndColor(terminal.screen, ev);
}

function scanAndColor(screen: Screen, ev: LineRangeChange): void {
  for (let y = ev.startLine; y < ev.endLine; y++) {
    const text = screen.getRowText(y);
    for (const rule of liveRules) {
      for (const match of text.matchAll(rule.matchRegexp)) {
        const row = screen.getBaseRow(y);
        const matchText = match[0];
        const matchWidthCells = countCells(matchText);
        const index = match.index;
        for (let i=0; i<matchWidthCells; i++) {
          const x = index + i;
          if (rule.foreground != null) {
            row.setFgClutIndex(x, rule.foreground);
          }
          if (rule.background != null) {
            row.setBgClutIndex(x, rule.background);
          }
          if (rule.isBold) {
            const style = row.getStyle(x);
            row.setStyle(x, style | STYLE_MASK_BOLD);
          }
          if (rule.isItalic) {
            const style = row.getStyle(x);
            row.setStyle(x, style | STYLE_MASK_ITALIC);
          }
          if (rule.isUnderline) {
            const style = row.getStyle(x);
            row.setStyle(x, (style & ~STYLE_MASK_UNDERLINE) | UNDERLINE_STYLE_NORMAL);
          }
        }
      }
    }
  }
}

function colorizerTab(extensionTab: SettingsTab): void {
  const page = new ColorizerSettingsPage(extensionTab, config, context.settings.terminal, log);
  page.onConfigChanged((config) => {
    context.configuration.set(config);
    liveRules = compileRules(config.rules);
  });
}
