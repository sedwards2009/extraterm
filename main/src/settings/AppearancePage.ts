/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QCheckBox, QComboBox, QLabel, QScrollArea, QSizePolicyPolicy, QWidget, TextFormat } from "@nodegui/nodegui";
import { default as open } from "open";
import { BoxLayout, CheckBox, ComboBox, ComboBoxItem, GridLayout, Label, PushButton, ScrollArea, SpinBox,
  Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { ConfigDatabase } from "../config/ConfigDatabase.js";
import { GeneralConfig, TerminalMarginStyle, TitleBarStyle } from "../config/Config.js";
import { UiStyle } from "../ui/UiStyle.js";
import { createHtmlIcon } from "../ui/Icons.js";
import { makeGroupLayout, shrinkWrap } from "../ui/QtConstructExtra.js";
import { ThemeManager } from "../theme/ThemeManager.js";
import { ThemeInfo } from "../theme/Theme.js";
import { ExtensionManager } from "../InternalTypes.js";
import { TerminalBlock } from "../terminal/TerminalBlock.js";
import * as Term from "../emulator/Term.js";
import { QtTimeout } from "../utils/QtTimeout.js";
import { TerminalVisualConfig } from "../terminal/TerminalVisualConfig.js";
import { FontAtlasCache } from "../terminal/FontAtlasCache.js";
import { SettingsPageType } from "./SettingsPageType.js";


const uiScalePercentOptions: {id: number, name: string}[] = [
  { id: 25, name: "25%"},
  { id: 50, name: "50%"},
  { id: 65, name: "65%"},
  { id: 80, name: "80%"},
  { id: 90, name: "90%"},
  { id: 100, name: "100%"},
  { id: 110, name: "110%"},
  { id: 120, name: "120%"},
  { id: 150, name: "150%"},
  { id: 175, name: "175%"},
  { id: 200, name: "200%"},
  { id: 250, name: "250%"},
  { id: 300, name: "300%"},
];

const titleBarOptions: {id: TitleBarStyle, name: string}[] = [
  { id: "native", name: "Native" },
  { id: "theme", name: "Theme" },
  { id: "compact", name: "Compact Theme" },
];

const PREVIEW_WIDTH_CELLS = 45;


export class AppearancePage implements SettingsPageType {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #extensionManager: ExtensionManager = null;
  #uiStyle: UiStyle = null;
  #fontAtlasCache: FontAtlasCache = null;

  #previewTerminalBlock: TerminalBlock = null;
  #previewEmulator: Term.Emulator = null;
  #qtTimeout: QtTimeout = null;
  #terminalVisualConfig: TerminalVisualConfig = null;
  #previewContainer: QWidget = null;

  #terminalThemeCombo: QComboBox = null;
  #terminalThemes: ThemeInfo[];
  #terminalThemeCommentSpacer: QLabel = null;
  #terminalThemeCommentLabel: QLabel = null;

  #minimizeWindowToTrayCheckBox: QCheckBox = null;

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager, themeManager: ThemeManager,
      uiStyle: UiStyle, fontAtlasCache: FontAtlasCache) {

    this._log = getLogger("AppearancePage", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;
    this.#fontAtlasCache = fontAtlasCache;
  }

  getIconName(): string {
    return "fa-paint-brush";
  }

  getMenuText(): string {
    return "Appearance";
  }

  getPage(): QScrollArea {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    const systemConfig = this.#configDatabase.getSystemConfig();

    const allFonts = systemConfig.availableFonts;
    const currentFontIndex = allFonts.map(f => f.id).indexOf(generalConfig.terminalFont);

    const update = (mutator: (config: GeneralConfig) => void): void => {
      const generalConfig = this.#configDatabase.getGeneralConfigCopy();
      mutator(generalConfig);
      this.#configDatabase.setGeneralConfig(generalConfig);
    };
    const showTitleBar = (<Term.Platform> process.platform) === "linux";
    const marginSizes: TerminalMarginStyle[] = [
      "none",
      "thin",
      "normal",
      "thick"
    ];
    this.#initPreview();

    const page = ScrollArea({
      cssClass: "settings-tab",
      widgetResizable: true,

      widget: Widget({
        cssClass: "settings-tab",
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            Label({
              text: `${createHtmlIcon("fa-paint-brush")}&nbsp;&nbsp;Appearance`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]
            }),
            GridLayout({
              columns: 2,
              children: [

                {widget: Label({text: "Terminal", cssClass: "h3"}), colSpan: 2},

                "Font:",
                shrinkWrap(ComboBox({
                  currentIndex: currentFontIndex,
                  items: allFonts.map((f): ComboBoxItem => ({ text: f.name, userData: f.id })),
                  onActivated: (index: number) => {
                    update(c => c.terminalFont = allFonts[index].id);
                  }
                })),

                "Font Size:",
                makeGroupLayout(
                  SpinBox({
                    minimum: 1,
                    maximum: 1024,
                    value: generalConfig.terminalFontSize,
                    onValueChanged: (value: number) => {
                      update((c) => c.terminalFontSize = value);
                    },
                  }),
                  "point"
                ),

                "",
                CheckBox({
                  text: "Enable ligatures",
                  checkState: generalConfig.terminalDisplayLigatures,
                  onStateChanged: (state: number) => {
                    update((c) => c.terminalDisplayLigatures = Boolean(state));
                  }
                }),

                "Theme:",
                BoxLayout({
                  direction: Direction.LeftToRight,
                  spacing: 0,
                  contentsMargins: [0, 0, 0, 0],
                  children: [
                    this.#terminalThemeCombo = ComboBox({
                      currentIndex: 0,
                      items: [],
                      onActivated: (index) => {
                        const themeId = this.#terminalThemes[index].id;
                        update(config => {
                          config.themeTerminal = themeId;
                        });
                        this.#selectTerminalTheme(themeId);
                      }
                    }),
                    { widget: Widget({}), stretch: 1 }
                  ]
                }),

                "",
                Label({
                  cssClass: ["minor"],
                  text: this.#formatTerminalThemeFormats()
                }),

                "",
                makeGroupLayout(
                  PushButton({
                    text: "User themes",
                    icon: this.#uiStyle.getButtonIcon("fa-folder-open"),
                    cssClass: "small",
                    onClicked: () => this.#handleTerminalThemeFolderClicked()
                  }),
                  PushButton({
                    icon: this.#uiStyle.getButtonIcon("fa-sync-alt"),
                    cssClass: "small",
                    onClicked: () => this.#handleTerminalThemeScanClicked()
                  }),
                ),

                this.#terminalThemeCommentSpacer = Label({}),
                this.#terminalThemeCommentLabel = Label({
                  cssClass: ["minor"],
                  textFormat: TextFormat.RichText,
                  wordWrap: true,
                }),

                "Cursor Style:",
                makeGroupLayout(
                  PushButton({
                    text: "\u{2588}",
                    cssClass: ["small"],
                    checkable: true,
                    autoExclusive: true,
                    checked: generalConfig.cursorStyle === "block",
                    onClicked: () => update(config => config.cursorStyle = "block")
                  }),
                  PushButton({
                    text: "\u{2582}",
                    cssClass: ["small"],
                    checkable: true,
                    autoExclusive: true,
                    checked: generalConfig.cursorStyle === "underscore",
                    onClicked: () => update(config => config.cursorStyle = "underscore")
                  }),
                  PushButton({
                    text: "\u{2503}",
                    cssClass: ["small"],
                    checkable: true,
                    autoExclusive: true,
                    checked: generalConfig.cursorStyle === "beam",
                    onClicked: () => update(config => config.cursorStyle = "beam")
                  }),
                ),

                "Margin:",
                shrinkWrap(ComboBox({
                  currentIndex: marginSizes.indexOf(generalConfig.terminalMarginStyle),
                  items: ["None", "Thin", "Normal", "Thick"],
                  onActivated: (index) => {
                    update(config => config.terminalMarginStyle = marginSizes[index]);
                  }
                })),

                {
                  colSpan: 2,
                  widget: this.#previewContainer
                },

                {widget: Label({text: "Interface", cssClass: "h3"}), colSpan: 2},

                "Zoom:",
                shrinkWrap(ComboBox({
                  currentIndex: uiScalePercentOptions.map(option => option.id).indexOf(generalConfig.uiScalePercent),
                  items: uiScalePercentOptions.map(option => option.name),
                  onActivated: (index) => {
                    update(config => config.uiScalePercent = uiScalePercentOptions[index].id);
                  }
                })),

                showTitleBar && "Window Title Bar:",
                showTitleBar && shrinkWrap(ComboBox({
                  currentIndex: titleBarOptions.map(option => option.id).indexOf(generalConfig.titleBarStyle),
                  items: titleBarOptions.map(item => item.name),
                  onActivated: (index) => {
                    update(config => config.titleBarStyle = titleBarOptions[index].id);
                  }
                })),

                "",
                CheckBox({
                  text: "Show system tray icon",
                  checkState: generalConfig.showTrayIcon,
                  onStateChanged: (state: number) => {
                    const isOn = Boolean(state);
                    update((c) => c.showTrayIcon = isOn);
                    this.#minimizeWindowToTrayCheckBox.setEnabled(isOn);
                  }
                }),

                "",
                this.#minimizeWindowToTrayCheckBox = CheckBox({
                  text: "Minimize windows to tray",
                  checkState: generalConfig.minimizeToTray,
                  enabled: generalConfig.showTrayIcon,
                  onStateChanged: (state: number) => {
                    update((c) => c.minimizeToTray = Boolean(state));
                  }
                }),
              ]
            }),
            {stretch: 1, widget: Widget({}) }
          ]}
        )
      })
    });
    this.#loadTerminalThemes();
    return page;
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this.#terminalVisualConfig = terminalVisualConfig;
    if (this.#previewTerminalBlock != null) {
      this.#previewTerminalBlock.setTerminalVisualConfig(this.#terminalVisualConfig);
      this.#previewContainer.setMinimumWidth(this.#previewTerminalBlock.getCellWidthPx() * PREVIEW_WIDTH_CELLS);
      this.#previewTerminalBlock.getWidget().update();
    }
  }

  #initPreview(): void {
    this.#qtTimeout = new QtTimeout();
    this.#previewEmulator = new Term.Emulator({
      platform: <Term.Platform> process.platform,
      applicationModeCookie: "",
      debug: true,
      performanceNowFunc: () => performance.now(),

      setTimeout: this.#qtTimeout.setTimeout.bind(this.#qtTimeout),
      clearTimeout: this.#qtTimeout.clearTimeout.bind(this.#qtTimeout),
    });

    this.#previewTerminalBlock = new TerminalBlock(this.#fontAtlasCache);
    if (this.#terminalVisualConfig != null) {
      this.#previewTerminalBlock.setTerminalVisualConfig(this.#terminalVisualConfig);
    }
    this.#previewTerminalBlock.setEmulator(this.#previewEmulator);
    this.#previewEmulator.write(this.#previewContents());

    this.#previewContainer = Widget({
      cssClass: ["terminal-preview-container"],
      sizePolicy: {
        vertical: QSizePolicyPolicy.Preferred,
        horizontal: QSizePolicyPolicy.Maximum,
      },
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        children: [this.#previewTerminalBlock.getWidget()]
      })
    });

    this.#previewContainer.setMinimumWidth(this.#previewTerminalBlock.getCellWidthPx() * PREVIEW_WIDTH_CELLS);
  }

  #previewContents(): string {
    const defaultFG = "\x1b[0m";
    const defaultColor = "\x1b[0m";
    const newline = "\n\r ";

    let result = newline;

    for (let i=0; i<16; i++) {
      if (i === 8) {
        result += "\n\r ";
      }
      result += " ";
      if (i >= 1) {
        result += this.#charFG(0);
      }

      result += this.#charBG(i);
      if (i < 10) {
        result += " ";
      }
      result += " " + i + " " + defaultColor;
    }

    result += this.#charFG(0);

    result += newline + defaultFG + newline +
      " " + this.#boldFG(4) + "dir" + defaultColor + "/         " + this.#boldFG(2) + "script.sh" + defaultColor + "*" + newline +
      " file         " + this.#boldFG(6) + "symbolic_link" + defaultColor + " -> something" + newline +
      " " + this.#boldFG(5) + "image.png" + defaultColor + "    " + this.#boldFG(1) + "shambolic_link" + defaultColor + " -> " + this.#boldFG(1) + "nothing" + defaultColor + newline +
      " \x1b[30;42mtmp" + defaultColor + "/" + newline +
      newline +
      " " + this.#charFG(2) +"[user@computer " + this.#charFG(12) + "/home/user" + this.#charFG(2) + "]$ "+ defaultColor;

    return result;
  }

  #boldFG(n: number): string {
    return `\x1b[1;${30+n}m`;
  }

  #charFG(n: number): string {
    return `\x1b[38;5;${n}m`;
  }

  #charBG(n: number): string {
    return `\x1b[48;5;${n}m`;
  }

  #loadTerminalThemes(): void {
    this.#terminalThemes = this.#themeManager.getAllThemes().filter(theme => theme.type === "terminal");
    this.#terminalThemes.sort((a: ThemeInfo, b: ThemeInfo): number => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      return aName < bName ? -1 : (aName === bName ? 0 : 1);
    });

    this.#terminalThemeCombo.clear();
    this.#terminalThemeCombo.addItems(this.#terminalThemes.map(theme => theme.name));

    const generalConfig = this.#configDatabase.getGeneralConfig();
    const selectedIndex = this.#terminalThemes.findIndex(theme => theme.id === generalConfig.themeTerminal);
    this.#terminalThemeCombo.setCurrentIndex(selectedIndex);

    this.#selectTerminalTheme(generalConfig.themeTerminal);
  }

  #selectTerminalTheme(themeName: string): void {
    const selectedIndex = this.#terminalThemes.findIndex(theme => theme.id === themeName);
    this.#terminalThemeCombo.setCurrentIndex(selectedIndex);

    const comment = this.#terminalThemes[selectedIndex].comment;
    if (comment != null && comment !== "") {
      this.#terminalThemeCommentSpacer.show();
      this.#terminalThemeCommentLabel.show();
      this.#terminalThemeCommentLabel.setText(`${createHtmlIcon("fa-info-circle")} ${comment}`);
    } else {
      this.#terminalThemeCommentSpacer.hide();
      this.#terminalThemeCommentLabel.hide();
      this.#terminalThemeCommentLabel.setText("");
    }
  }

  #formatTerminalThemeFormats(): string {
    const formatNames = this.#extensionManager.getAllTerminalThemeFormats().map(pair => pair.formatName);
    return `Supported theme formats: ${formatNames.join(", ")}`;
  }

  #handleTerminalThemeFolderClicked(): void {
    const systemConfig = this.#configDatabase.getSystemConfig();
    open(systemConfig.userTerminalThemeDirectory);
  }

  #handleTerminalThemeScanClicked(): void {
    this.#themeManager.rescan();
    this.#loadTerminalThemes();
  }
}
