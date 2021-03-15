/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "path";
import { Event } from "@extraterm/extraterm-extension-api";
import { later } from "extraterm-later";
import { BrowserWindow, Menu, Tray, screen, MenuItemConstructorOptions } from "electron";

import { ConfigChangeEvent, ConfigDatabase, GeneralConfig, GENERAL_CONFIG, SingleWindowConfiguration } from "../Config";
import * as ResourceLoader from "../ResourceLoader";
import { ThemeManager } from "../theme/ThemeManager";
import { bestOverlap } from "./RectangleMatch";
import { EventEmitter } from "../utils/EventEmitter";

const PNG_ICON_PATH = "../../resources/logo/extraterm_small_logo_256x256.png";
const ICO_ICON_PATH = "../../resources/logo/extraterm_small_logo.ico";

const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";
const isDarwin = process.platform === "darwin";

export interface OpenWindowOptions {
  openDevTools?: boolean;
}

let SetWindowCompositionAttribute: any = null;
let AccentState: any = null;

if (isWindows) {
  SetWindowCompositionAttribute = require("windows-swca").SetWindowCompositionAttribute;
  AccentState = require("windows-swca").ACCENT_STATE;
}

/**
 * UI, desktop, and window related UI code which runs in the main process.
 */
export class MainDesktop {
  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #tray: Tray = null;
  #appWindowIds: number[] = [];

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

  getBrowserWindowIds(): number[] {
    return [...this.#appWindowIds];
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

  async toggleAllWindows(): Promise<void> {
    if (this._anyWindowsMinimized()) {
      await this.restoreAllWindows();
    } else {
      this.minimizeAllWindows();
    }
  }

  private _anyWindowsMinimized(): boolean {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isMinimized() || ! window.isVisible()) {
        return true;
      }
    }
    return false;
  }

  async maximizeAllWindows(): Promise<void> {
    for (const window of BrowserWindow.getAllWindows()) {
      window.show();
      window.maximize();
      if ( ! isLinux) {
        window.moveTop();
      }
    }
  }

  async minimizeAllWindows(): Promise<void> {
    this._saveAllWindowDimensions();

    for (const window of BrowserWindow.getAllWindows()) {
      const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
      if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
        window.hide();
      } else {
        window.minimize();
      }
    }
  }

  async restoreAllWindows(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const windowId of this.#appWindowIds) {
      promises.push(this.restoreWindow(windowId));
    }
    await Promise.all(promises);
  }

  async restoreWindow(windowId: number): Promise<void> {
    let i = 0;

    const promises: Promise<void>[] = [];
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.id === windowId) {
        const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);

        const bounds = generalConfig.windowConfiguration[i];
        if (isLinux) {
          // On Linux, if a window is the width or height of the screen then
          // Electron (2.0.13) resizes them (!) to be smaller for some annoying
          // reason. This is a hack to make sure that windows are restored with
          // the correct dimensions.
          if (bounds != null) {
            window.setBounds(bounds);
            window.setMinimumSize(bounds.width, bounds.height);
          }

          if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
            window.show();
          }
          window.restore();

          promises.push(
            later(100).then(() => {
              window.setMinimumSize(10, 10);
            })
          );

        } else {

          // Windows and macOS
          if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
            if (bounds != null) {
              if (bounds.isMaximized === true) {
                window.maximize();
              }
              this._checkWindowBoundsLater(window, bounds);
            }

            window.show();
          }
          window.restore();

          promises.push(
            later().then(() => {
              window.moveTop();
              window.focus();
            })
          );
        }
      }
      i++;
    }
    await Promise.all(promises);
  }

  openWindow(options: OpenWindowOptions=null): number {
    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
    const themeInfo = this.#themeManager.getTheme(generalConfig.themeGUI);

    // Create the browser window.
    const newBrowserWindowOptions = <Electron.BrowserWindowConstructorOptions> {
      width: 1200,
      height: 600,
      webPreferences: {
        experimentalFeatures: true,
        nodeIntegration: true
      },
      title: "Extraterm",
      backgroundColor: "#00000000",
      show: false,
    };

    if (isDarwin) {
      if (generalConfig.titleBarStyle === "native") {
        newBrowserWindowOptions.frame = true;
      } else {
        if (generalConfig.titleBarStyle === "theme") {
          newBrowserWindowOptions.titleBarStyle = "hidden";
        } else {
          // Compact
          newBrowserWindowOptions.titleBarStyle = "hiddenInset";
        }
      }
    } else {
      newBrowserWindowOptions.frame = generalConfig.titleBarStyle === "native";
    }

    // Restore the window position and size from the last session.
    const dimensions = this._getWindowDimensionsFromConfig(this.#appWindowIds.length);
    if (dimensions != null) {
      newBrowserWindowOptions.x = dimensions.x;
      newBrowserWindowOptions.y = dimensions.y;
      newBrowserWindowOptions.width = dimensions.width;
      newBrowserWindowOptions.height = dimensions.height;
    }

    if (isWindows) {
      newBrowserWindowOptions.icon = path.join(__dirname, ICO_ICON_PATH);
    } else if (isLinux) {
      newBrowserWindowOptions.icon = path.join(__dirname, PNG_ICON_PATH);
    }

    const newWindow = new BrowserWindow(newBrowserWindowOptions);

    if (options?.openDevTools) {
      newWindow.webContents.openDevTools();
    }

    newWindow.setMenu(null);

    // Emitted when the window is closed.
    const mainWindowWebContentsId = newWindow.webContents.id;
    const newWindowId = newWindow.id;
    newWindow.on("closed", () => {
      this.#onWindowClosedEventEmitter.fire(mainWindowWebContentsId);
      this.#appWindowIds = this.#appWindowIds.filter(wId => wId !== newWindowId);
    });

    newWindow.on("close", this._saveAllWindowDimensions);
    newWindow.on("resize", this._saveAllWindowDimensions);
    newWindow.on("maximize", this._saveAllWindowDimensions);
    newWindow.on("unmaximize", this._saveAllWindowDimensions);

    this._setupTransparentBackground(newWindow);
    this._checkWindowBoundsLater(newWindow, dimensions);

    const params = "?loadingBackgroundColor=" + themeInfo.loadingBackgroundColor.replace("#", "") +
      "&loadingForegroundColor=" + themeInfo.loadingForegroundColor.replace("#", "");

    // and load the index.html of the app.
    newWindow.loadURL(ResourceLoader.toUrl("render_process/main.html") + params);

    newWindow.webContents.on("devtools-closed", () => {
      this.#onDevToolsClosedEventEmitter.fire(newWindow);
    });
    newWindow.webContents.on("devtools-opened", () => {
      this.#onDevToolsOpenedEventEmitter.fire(newWindow);
    });

    this.#appWindowIds.push(newWindow.id);
    return newWindow.id;
  }

  getAllWindowIds(): number[] {
    return [...this.#appWindowIds];
  }

  private _checkWindowBoundsLater(window: BrowserWindow, desiredConfig: SingleWindowConfiguration): void {
    window.once("ready-to-show", () => {
      const windowBounds = window.getNormalBounds();

      // Figure out which Screen this window is meant to be on.
      const windowDisplay = this._matchWindowToDisplay(window);
      const newDimensions: Electron.Rectangle = { ...windowBounds };

      let updateNeeded = false;

      if (desiredConfig != null && desiredConfig.isMaximized === true) {
        if (windowBounds.x !== windowDisplay.workArea.x ||
            windowBounds.y !== windowDisplay.workArea.y ||
            windowBounds.width !== windowDisplay.workArea.width ||
            windowBounds.height !== windowDisplay.workArea.height) {

          window.maximize();
        }
      } else {

        if (desiredConfig != null) {
          if (newDimensions.width < desiredConfig.width) {
            newDimensions.width = desiredConfig.width;
            updateNeeded = true;
          }
          if (newDimensions.height < desiredConfig.height) {
            newDimensions.height = desiredConfig.height;
            updateNeeded = true;
          }
        }

        // Clamp the width/height to fit on the display.
        if (newDimensions.width > windowDisplay.workArea.width) {
          newDimensions.width = windowDisplay.workArea.width;
          updateNeeded = true;
        }
        if (newDimensions.height > windowDisplay.workArea.height) {
          newDimensions.height = windowDisplay.workArea.height;
          updateNeeded = true;
        }

        // Slide the window to avoid being half off the display.
        if (newDimensions.x < windowDisplay.workArea.x) {
          newDimensions.x = windowDisplay.workArea.x;
          updateNeeded = true;
        }
        if (newDimensions.y < windowDisplay.workArea.y) {
          newDimensions.y = windowDisplay.workArea.y;
          updateNeeded = true;
        }

        const displayRightEdgeX = windowDisplay.workArea.width + windowDisplay.workArea.x;
        if (newDimensions.width + newDimensions.x > displayRightEdgeX) {
          newDimensions.x = displayRightEdgeX - newDimensions.width;
          updateNeeded = true;
        }

        const displayBottomEdgeY = windowDisplay.workArea.height + windowDisplay.workArea.y;
        if (newDimensions.height + newDimensions.y > displayBottomEdgeY) {
          newDimensions.y = displayBottomEdgeY - newDimensions.height;
          updateNeeded = true;
        }

        if (updateNeeded) {
          // Enforce minimum and sane width/height values.
          newDimensions.height = Math.max(100, newDimensions.height);
          newDimensions.width = Math.max(100, newDimensions.width);
        }
      }

      if (updateNeeded) {
        window.setBounds(newDimensions);
      }
    });
  }

  private _matchWindowToDisplay(window: BrowserWindow): Electron.Display {
    const displays = screen.getAllDisplays();
    const displayAreas = displays.map(d => d.workArea);

    const matchIndex = bestOverlap(window.getNormalBounds(), displayAreas);
    if (matchIndex === -1) {
      return screen.getPrimaryDisplay();
    }
    return displays[matchIndex];
  }

  private _saveAllWindowDimensions(): void {
    for (let i=0; i<this.#appWindowIds.length; i++) {
      const window = BrowserWindow.fromId(this.#appWindowIds[i]);

      const rect = window.getNormalBounds();
      const isMaximized = window.isMaximized();

      const newGeneralConfig = <GeneralConfig> this.#configDatabase.getConfigCopy(GENERAL_CONFIG);

      if (newGeneralConfig.windowConfiguration == null) {
        newGeneralConfig.windowConfiguration = {};
      }
      newGeneralConfig.windowConfiguration[i] = {
        isMaximized,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
      this.#configDatabase.setConfig(GENERAL_CONFIG, newGeneralConfig);
    }
  }

  private _getWindowDimensionsFromConfig(windowId: number): SingleWindowConfiguration {
    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
    if (generalConfig.windowConfiguration == null) {
      return null;
    }
    const singleWindowConfig = generalConfig.windowConfiguration[windowId];
    if (singleWindowConfig == null) {
      return null;
    }
    return singleWindowConfig;
  }

  private _setupTransparentBackground(window: BrowserWindow): void {
    const setWindowComposition = () => {
      const generalConfig = <GeneralConfig> this.#configDatabase.getConfig("general");
      const isWindowOpaque = generalConfig.windowBackgroundMode === "opaque";
      if (isWindows) {
        const accent = isWindowOpaque
                        ? AccentState.ACCENT_DISABLED
                        : AccentState.ACCENT_ENABLE_BLURBEHIND;
        SetWindowCompositionAttribute(window.getNativeWindowHandle(), accent, 0);
      }
      if (isDarwin) {
        if ( ! isWindowOpaque) {
          window.setVibrancy("dark");
        }
      }
    };

    this.#configDatabase.onChange(event => {
      if (event.key === "general" &&
          event.oldConfig.windowBackgroundMode !== event.newConfig.windowBackgroundMode) {
        setWindowComposition();
      }
    });

    window.once("ready-to-show", () => {
      setWindowComposition();
      window.show();
    });
  }
}
