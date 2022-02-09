/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QComboBox, QLabel, QScrollArea, TextFormat } from "@nodegui/nodegui";
import * as open from "open";
import { BoxLayout, CheckBox, ComboBox, ComboBoxItem, GridLayout, Label, PushButton, ScrollArea, SpinBox,
  Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { GeneralConfig, TerminalMarginStyle, TitleBarStyle } from "../config/Config";
import { UiStyle } from "../ui/UiStyle";
import { createHtmlIcon } from "../ui/Icons";
import { makeGroupLayout, shrinkWrap } from "../ui/QtConstructExtra";
import { ThemeManager } from "../theme/ThemeManager";
import { ThemeInfo } from "../theme/Theme";
import { ExtensionManager } from "../InternalTypes";


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

export class AppearancePage {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #extensionManager: ExtensionManager = null;
  #uiStyle: UiStyle = null;

  #terminalThemeCombo: QComboBox = null;
  #terminalThemes: ThemeInfo[]
  #terminalThemeCommentSpacer: QLabel = null;
  #terminalThemeCommentLabel: QLabel = null;

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager, themeManager: ThemeManager,
      uiStyle: UiStyle) {

    this._log = getLogger("AppearancePage", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;
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

    const marginSizes: TerminalMarginStyle[] = [
      "none",
      "thin",
      "normal",
      "thick"
    ];

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

                {widget: Label({text: "Interface", cssClass: "h3"}), colSpan: 2},

                "Zoom:",
                shrinkWrap(ComboBox({
                  currentIndex: uiScalePercentOptions.map(option => option.id).indexOf(generalConfig.uiScalePercent),
                  items: uiScalePercentOptions.map(option => option.name),
                  onActivated: (index) => {
                    update(config => config.uiScalePercent = uiScalePercentOptions[index].id);
                  }
                })),

                "Window Title Bar:",
                shrinkWrap(ComboBox({
                  currentIndex: titleBarOptions.map(option => option.id).indexOf(generalConfig.titleBarStyle),
                  items: titleBarOptions.map(item => item.name),
                  onActivated: (index) => {
                    update(config => config.titleBarStyle = titleBarOptions[index].id);
                  }
                })),
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
