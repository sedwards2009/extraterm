/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "path";
import { Event } from "@extraterm/extraterm-extension-api";
import { BrowserWindow, Menu, Tray, MenuItemConstructorOptions } from "electron";

import { ConfigChangeEvent, ConfigDatabase, GeneralConfig, GENERAL_CONFIG } from "../Config";
import { MainWindow, OpenWindowOptions } from "./MainWindow";
import { ThemeManager } from "../theme/ThemeManager";
import { EventEmitter } from "../utils/EventEmitter";
import { MainWindowImpl } from "./MainWindowImpl";


const isLinux = process.platform === "linux";
const isDarwin = process.platform === "darwin";


/**
 * UI, desktop, and window related UI code which runs in the main process.
 */
export class MainDesktop {
  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #tray: Tray = null;

  #onAboutSelectedEventEmitter = new EventEmitter<void>();
  onAboutSelected: Event<void>;

  #onPreferencesSelectedEventEmitter = new EventEmitter<void>();
  onPreferencesSelected: Event<void>;

  #onQuitSelectedEventEmitter = new EventEmitter<void>();
  onQuitSelected: Event<void>;

  #onWindowClosedEventEmitter = new EventEmitter<number>();
  onWindowClosed: Event<number>;

  #onDevToolsOpenedEventEmitter = new EventEmitter<BrowserWindow>();
  onDevToolsOpened: Event<BrowserWindow>;

  #onDevToolsClosedEventEmitter = new EventEmitter<BrowserWindow>();
  onDevToolsClosed: Event<BrowserWindow>;

  #extratermWindows: MainWindowImpl[] = [];

  constructor(configDatabase: ConfigDatabase, themeManager: ThemeManager) {
    this.#configDatabase = configDatabase;
    this.#themeManager = themeManager;

    this.onAboutSelected = this.#onAboutSelectedEventEmitter.event;
    this.onPreferencesSelected = this.#onPreferencesSelectedEventEmitter.event;
    this.onQuitSelected = this.#onQuitSelectedEventEmitter.event;
    this.onWindowClosed = this.#onWindowClosedEventEmitter.event;
    this.onDevToolsOpened = this.#onDevToolsOpenedEventEmitter.event;
    this.onDevToolsClosed = this.#onDevToolsClosedEventEmitter.event;

    this._saveAllWindowDimensions = this._saveAllWindowDimensions.bind(this);
  }

  start(): void {
    this._createTrayIcon();
    this._setUpMenu();
    this.#configDatabase.onChange((e: ConfigChangeEvent) => {
      if (e.key === "general") {
        this._createTrayIcon();
      }
    });
  }

  private _createTrayIcon(): void {
    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);

    if (generalConfig.showTrayIcon) {
      if (this.#tray == null) {
        let iconFilename = "";
        if (isDarwin) {
          iconFilename = path.join(__dirname, "../../resources/tray/macOSTrayIconTemplate.png");
        } else if (isLinux) {
          iconFilename = path.join(__dirname, "../../resources/tray/extraterm_tray.png");
        } else {
          iconFilename = path.join(__dirname, "../../resources/tray/extraterm_small_logo.ico");
        }

        this.#tray = new Tray(iconFilename);
        this.#tray.setToolTip("Extraterm");

        if (isDarwin) {
          this.#tray.setPressedImage(path.join(__dirname, "../../resources/tray/macOSTrayIconHighlight.png"));
        }

        const contextMenu = Menu.buildFromTemplate([
          {label: "Maximize", type: "normal", click: this.maximizeAllWindows.bind(this)},
          {label: "Minimize", type: "normal", click: this.minimizeAllWindows.bind(this)},
          {label: "Restore", type: "normal", click: this.restoreAllWindows.bind(this)},
        ]);
        this.#tray.setContextMenu(contextMenu);

        this.#tray.on("click", this.toggleAllWindows.bind(this));
      }
    } else {
      if (this.#tray != null) {
        this.#tray.destroy();
        this.#tray = null;
      }
    }
  }

  private _setUpMenu(): void {
    if (isDarwin) {
      this._setupOSXMenus();
    } else {
      Menu.setApplicationMenu(null);
    }
  }

  private _setupOSXMenus(): void {
    const template: MenuItemConstructorOptions[] = [{
      label: "Extraterm",
      submenu: [
        {
          label: "About Extraterm",
          click: () => {
            this.#onAboutSelectedEventEmitter.fire();
          },
        },
        {
          type: "separator"
        },
        {
          label: "Preferences...",
          click: () => {
            this.#onPreferencesSelectedEventEmitter.fire();
          },
        },
        {
          type: "separator"
        },
        {
          label: "Quit",
          click: () =>  {
            this.#onQuitSelectedEventEmitter.fire();
          },
          accelerator: "Command+Q"
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ]
    }
    ];

    const topMenu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(topMenu);
  }

  getExtratermWindowByBrowserWindow(browserWindow: BrowserWindow): MainWindow {
    return this.getWindowById(browserWindow.id);
  }

  async toggleAllWindows(): Promise<void> {
    if (this._anyWindowsMinimized()) {
      await this.restoreAllWindows();
    } else {
      this.minimizeAllWindows();
    }
  }

  private _anyWindowsMinimized(): boolean {
    for (const ew of this.#extratermWindows) {
      if (ew.isMinimized() || ! ew.isVisible()) {
        return true;
      }
    }
    return false;
  }

  async maximizeAllWindows(): Promise<void> {
    for (const ew of this.#extratermWindows) {
      ew.show();
      ew.maximize();
      if ( ! isLinux) {
        ew.moveTop();
      }
    }
  }

  async minimizeAllWindows(): Promise<void> {
    this._saveAllWindowDimensions();

    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
    for (const ew of this.#extratermWindows) {
      if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
        ew.hide();
      } else {
        ew.minimize();
      }
    }
  }

  async restoreAllWindows(): Promise<void> {
    await Promise.all(this.#extratermWindows.map(ew => ew.restore()));
  }

  openWindow(options: OpenWindowOptions=null): MainWindow {
    const extratermWindow = new MainWindowImpl(this.#configDatabase, this.#themeManager,
      this.#extratermWindows.length);
    extratermWindow.onWindowDimensionChanged(this._saveAllWindowDimensions);

    extratermWindow.onWindowClosed((mainWindowWebContentsId: number) => {
      this.#onWindowClosedEventEmitter.fire(mainWindowWebContentsId);
      this.#extratermWindows = this.#extratermWindows.filter(ew => ew !== extratermWindow);
    });

    extratermWindow.onDevToolsClosed(() => {
      // this.#onDevToolsClosedEventEmitter.fire(newWindow);
    });
    extratermWindow.onDevToolsOpened(() => {
    //   this.#onDevToolsOpenedEventEmitter.fire(newWindow);
    });

    extratermWindow.open(options);
    this.#extratermWindows.push(extratermWindow);
    return extratermWindow;
  }

  getWindows(): MainWindow[] {
    return [...this.#extratermWindows];
  }

  getWindowById(windowId: number): MainWindow {
    for (const ew of this.#extratermWindows) {
      if (ew.id === windowId) {
        return ew;
      }
    }
    return null;
  }

  private _saveAllWindowDimensions(): void {
    for (const ew of this.#extratermWindows) {
      const rect = ew.getNormalBounds();
      const isMaximized = ew.isMaximized();

      const newGeneralConfig = <GeneralConfig> this.#configDatabase.getConfigCopy(GENERAL_CONFIG);

      if (newGeneralConfig.windowConfiguration == null) {
        newGeneralConfig.windowConfiguration = {};
      }
      newGeneralConfig.windowConfiguration[ew.configIndex] = {
        isMaximized,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
      this.#configDatabase.setConfig(GENERAL_CONFIG, newGeneralConfig);
    }
  }

  handleWindowReady(windowId: number): void {
    const ew = this.getWindowById(windowId);
    if (ew == null) {
      return;
    }
    (<MainWindowImpl> ew).handleWindowReady();
  }
}
