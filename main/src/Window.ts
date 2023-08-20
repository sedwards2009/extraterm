/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "node:path";
import { Logger, log, getLogger, objectName } from "extraterm-logging";
import { CDockAreaWidget, CDockManager, CDockWidget, CFloatingDockContainer, CFloatingDockContainerSignals,
  DockWidgetFeature, DockWidgetArea, TitleBarButton, eConfigFlag} from "nodegui-plugin-qads";
import { FontSlice } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { DebouncedDoLater, doLater } from "extraterm-timeoutqt";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { QWidget, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction, FocusPolicy, QKeyEvent, WidgetAttribute,
  QPoint, QRect, QKeySequence, QWindow, QScreen, QApplication, ContextMenuPolicy, QBoxLayout, QLabel, TextFormat,
  QMouseEvent, MouseButton, Visibility, QIcon, QSize, WindowState, WidgetEventTypes, wrapperCache, TextInteractionFlag,
  ShortcutContext, 
  QWheelEvent} from "@nodegui/nodegui";
import { Disposable, TerminalTheme } from "@extraterm/extraterm-extension-api";
import { Menu, ToolButton, Label, Widget, repolish } from "qt-construct";
import { loadFile as loadFontFile} from "extraterm-font-ligatures";
import he from "he";
import { hasEmojiPresentation } from "extraterm-unicode-utilities";

import * as SourceDir from "./SourceDir.js";
import { FontInfo, GeneralConfig, GENERAL_CONFIG } from "./config/Config.js";
import { ConfigChangeEvent, ConfigDatabase } from "./config/ConfigDatabase.js";
import { Tab } from "./Tab.js";
import { Terminal } from "./terminal/Terminal.js";
import { TerminalVisualConfig } from "./terminal/TerminalVisualConfig.js";
import { ThemeManager } from "./theme/ThemeManager.js";
import { CommandQueryOptions, ExtensionManager } from "./InternalTypes.js";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager.js";
import { qKeyEventToMinimalKeyboardEvent } from "./keybindings/QKeyEventUtilities.js";
import { UiStyle } from "./ui/UiStyle.js";
import { CachingLigatureMarker, LigatureMarker } from "./CachingLigatureMarker.js";
import { DisposableEventHolder, DisposableHolder } from "./utils/DisposableUtils.js";
import { createHtmlIcon } from "./ui/Icons.js";
import { SettingsTab } from "./settings/SettingsTab.js";
import { ContextMenuEvent } from "./ContextMenuEvent.js";
import { DecoratedFrame } from "./terminal/DecoratedFrame.js";
import { TWEMOJI_FAMILY } from "./TwemojiConstants.js";
import { BlockFrame } from "./terminal/BlockFrame.js";
import { CommonExtensionWindowState } from "./extension/CommonExtensionState.js";
import { Direction, nextDockAreaInDirection } from "./utils/QadsNext.js";
import { EmptyPaneTab } from "./EmptyPaneTab.js";


export function setupWindowManager(extensionManager: ExtensionManager, keybindingsManager: KeybindingsIOManager,
    configDatabase: ConfigDatabase, themeManager: ThemeManager, uiStyle: UiStyle): WindowManager {
  const windowManager = new WindowManager(extensionManager, keybindingsManager, configDatabase, themeManager, uiStyle);
  windowManager.init();
  return windowManager;
}

export class WindowManager {
  private _log: Logger = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsManager: KeybindingsIOManager = null;
  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #uiStyle: UiStyle = null;

  #dummyWindow: QWidget = null;
  #dockManager: CDockManager = null;
  #allWindows: Window[] = [];
  #allTabs: TabPlumbing[] = [];

  #emptyDockWidgets = new Set<CDockWidget>();

  onNewWindow: Event<Window> = null;
  #onNewWindowEventEmitter = new EventEmitter<Window>();

  constructor(extensionManager: ExtensionManager,keybindingsManager: KeybindingsIOManager,
        configDatabase: ConfigDatabase, themeManager: ThemeManager, uiStyle: UiStyle) {
    this._log = getLogger("WindowManager", this);
    this.#extensionManager = extensionManager;
    this.#keybindingsManager = keybindingsManager;
    this.#configDatabase = configDatabase;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;

    this.onNewWindow = this.#onNewWindowEventEmitter.event;
  }

  init(): void {
    CDockManager.setConfigFlag(eConfigFlag.FocusHighlighting, true);
    CDockManager.setConfigFlag(eConfigFlag.DockAreaHasCloseButton, false);
    CDockManager.setConfigFlag(eConfigFlag.DockAreaHasTabsMenuButton, false);
    CDockManager.setConfigFlag(eConfigFlag.DockAreaHasUndockButton, false);
    CDockManager.setConfigFlag(eConfigFlag.AlwaysShowTabs, true);
    CDockManager.setConfigFlag(eConfigFlag.AllTabsHaveCloseButton, true);
    CDockManager.setConfigFlag(eConfigFlag.FloatingContainerIndependent, true);
    CDockManager.setConfigFlag(eConfigFlag.DockWidgetTabTitle, false);
    CDockManager.setConfigFlag(eConfigFlag.DockWidgetTabContextMenu, false);
    CDockManager.setConfigFlag(eConfigFlag.EqualSplitOnInsertion, true);
    CDockManager.setConfigFlag(eConfigFlag.FloatingContainerHasWidgetIcon, true);
    QApplication.setWindowIcon(createWindowIcon());

    this.#dummyWindow = new QWidget();
    this.#dockManager = new CDockManager(this.#dummyWindow);
    this.#dockManager.setStyleSheet("", false);

    this.#dockManager.addEventListener("dockAreaCreated", (dockArea: any) => {
      const dockAreaWidget = wrapperCache.getWrapper(dockArea) as CDockAreaWidget;
      new DockAreaMenu(this.#extensionManager, this.#keybindingsManager, this.#uiStyle, dockAreaWidget);
    });
    this.#dockManager.addEventListener("dockAreaAboutToBeRemoved", (dockArea: any) => {
      const dockAreaWidget = wrapperCache.getWrapper(dockArea) as CDockAreaWidget;
      const container = dockAreaWidget.dockContainer();

      // This is a work-around for a thing which only affects Linux. When a
      // split/DockArea is removed, focus isn't automatically set on a remaining tab.
      if (process.platform === "linux" && container.isFloating()) {
        const win = this.getWindowForFloatingContainer(container.floatingWidget());
        doLater(() => {
          if ( ! this.#allWindows.includes(win)) {
            return;
          }
          win.focus();
          const tabCount = win.getTabCount();
          if (tabCount !== 0) {
            const i = Math.min(tabCount-1, win.getCurrentTabIndex());
            const tab = win.getTab(i);
            if (tab != null) {
              win.focusTab(tab);
            }
          }
        });
      }
    });

    this.#dockManager.addEventListener("floatingWidgetCreated", (nativeFloatingDockContainer: any) => {
      const floatingDockContainer = wrapperCache.getWrapper(nativeFloatingDockContainer) as CFloatingDockContainer;
      this.#handleFloatingDockContainer(floatingDockContainer);
    });

    this.#dockManager.addEventListener("floatingWidgetAboutToBeRemoved", (nativeFloatingDockContainer: any) => {
      const floatingDockContainer = wrapperCache.getWrapper(nativeFloatingDockContainer) as CFloatingDockContainer;
      this.#handleFloatingDockDestroy(floatingDockContainer);
    });

    this.#dockManager.addEventListener("dockWidgetAboutToBeRemoved", (dockWidget: any /* ads::CDockWidget */) => {
      const dw = wrapperCache.getWrapper(dockWidget) as CDockWidget;
    });

    this.#dockManager.addEventListener("dockWidgetAdded", (dockWidget: any /* ads::CDockWidget */) => {
      const dw = wrapperCache.getWrapper(dockWidget) as CDockWidget;
      this.#removeSpacers(dw.dockAreaWidget());
    });

    this.#dockManager.addEventListener("dockWidgetRemoved", (dockWidget: any /* ads::CDockWidget */) => {
      const dw = wrapperCache.getWrapper(dockWidget) as CDockWidget;
    });

    this.#dockManager.addEventListener("focusedDockWidgetChanged", (oldDockWidget: any /* ads::CDockWidget */,
        newDockWidget: any /* ads::CDockWidget */) => {
      const dw = wrapperCache.getWrapper(newDockWidget) as CDockWidget;
      const oldDw = wrapperCache.getWrapper(oldDockWidget) as CDockWidget;
      this.#handleFocusedDockWidgetChanged(dw, oldDw);
    });
  }

  #handleFocusedDockWidgetChanged(dockWidget: CDockWidget, previousDockWidget: CDockWidget): void {
    let window: Window = null;
    let tab: Tab = null;

    const oldTabPlumbing = this.getTabPlumbingForDockWidget(previousDockWidget);
    if (oldTabPlumbing != null) {
      oldTabPlumbing.setIsCurrent(false);
    }

    const tabPlumbing = this.getTabPlumbingForDockWidget(dockWidget);
    if (tabPlumbing != null) {
      window = this.getWindowForTab(tabPlumbing.tab);
      if (window == null) {
        return;
      }

      tabPlumbing.setIsCurrent(true);
      tab = tabPlumbing.tab;
    } else {
      // Empty "spacer" tab to hold the window open.
      const container = dockWidget.dockContainer();
      // FIXME: We might need the top level container.
      if (container.isFloating()) {
        window = this.#getWindowByFloatingDockContainer(container.floatingWidget());
        if (window == null) {
          return;
        }
      } else {
        return;
      }
    }

    this.#extensionManager.setActiveTab(tab);

    // const tab = tabPlumbing.tab;
    // if (tab instanceof Terminal) {
    //   this.#extensionManager.setActiveTerminal(tab);
    // } else {
    //   this.#extensionManager.setActiveTerminal(null);
    // }

    this.#extensionManager.setActiveWindow(window);
    window.handleTabFocusChanged(tab);
  }

  async #handleFloatingDockContainer(floatingDockContainer: CFloatingDockContainer): Promise<void> {
    let newWindow = this.#getWindowByFloatingDockContainer(floatingDockContainer);
    if (newWindow == null) {
      newWindow = new Window(this, floatingDockContainer, this.#configDatabase, this.#extensionManager,
        this.#keybindingsManager, this.#themeManager, this.#uiStyle);
      this.#allWindows.push(newWindow);
    }
    newWindow.init();
    this.#onNewWindowEventEmitter.fire(newWindow);
  }

  #handleFloatingDockDestroy(floatingDockContainer: CFloatingDockContainer): void {
    const window = this.#getWindowByFloatingDockContainer(floatingDockContainer);
    if (window != null) {
      this.disposeWindow(window);
    }
  }

  #getWindowByFloatingDockContainer(dockContainer: CFloatingDockContainer): Window {
    for (const win of this.#allWindows) {
      if (win.dockContainer === dockContainer) {
        return win;
      }
    }
    return null;
  }

  getDockManager(): CDockManager {
    return this.#dockManager;
  }

  createEmptyDockWidget(): CDockWidget {
    const label = Widget({
      cssClass: "window-background"
    });

    const emptyDockWidget = new CDockWidget("Extraterm");
    this.#emptyDockWidgets.add(emptyDockWidget);
    emptyDockWidget.setWidget(label);
    emptyDockWidget.setFeature(DockWidgetFeature.NoTab, true);
    return emptyDockWidget;
  }

  createWindow(geometry: QRect): Window {
    const emptyPaneTab = new EmptyPaneTab();
    const plumbing = this.prepareTab(emptyPaneTab);
    plumbing.dockWidget.setFeature(DockWidgetFeature.NoTab, true);

    const dockContainer = this.#dockManager.addDockWidgetFloating(plumbing.dockWidget);
    // ^ This will hit `handleNewFloatingDockContainer()` below via an event.

    if (geometry != null) {
      dockContainer.setGeometry(geometry.left(), geometry.top(), geometry.width(), geometry.height());
    }

    return this.#getWindowByFloatingDockContainer(dockContainer);
  }

  disposeWindow(window: Window): void {
    if ( ! this.#allWindows.includes(window)) {
      this._log.warn(`Double disposeWindow() on ${objectName(window)}`);
      return;
    }
    window.dispose();
    this.#allWindows = this.#allWindows.filter(w => w !== window);
  }

  #removeSpacers(dw: CDockAreaWidget): void {
    const openedDockWidgets = dw.openedDockWidgets();
    if (openedDockWidgets.length <= 1) {
      return;
    }
    for (const dockWidget of openedDockWidgets) {
      const plumbing = this.getTabPlumbingForDockWidget(dockWidget);
      if (plumbing.tab instanceof EmptyPaneTab) {
        const win = this.getWindowForTab(plumbing.tab);
        win.removeTab(plumbing.tab);
        break;
      }
    }
  }

  getAllWindows(): Window[] {
    return this.#allWindows;
  }

  getTabPlumbingForTab(tab: Tab): TabPlumbing {
    for (const tabPlumbing of this.#allTabs) {
      if (tabPlumbing.tab === tab) {
        return tabPlumbing;
      }
    }
    return null;
  }

  getTabPlumbingForDockWidget(dockWidget: CDockWidget): TabPlumbing {
    for (const tabPlumbing of this.#allTabs) {
      if (tabPlumbing.dockWidget === dockWidget) {
        return tabPlumbing;
      }
    }
    return null;
  }

  getWindowForFloatingContainer(floatingContainer: CFloatingDockContainer): Window {
    for (const win of this.#allWindows) {
      if (win.dockContainer === floatingContainer) {
        return win;
      }
    }
    return null;
  }

  getWindowForTab(tab: Tab): Window {
    for (const win of this.#allWindows) {
      if (win.hasTab(tab)) {
        return win;
      }
    }
    return null;
  }

  hasTab(tab: Tab): boolean {
    return this.#allTabs.map(t => t.tab).includes(tab);
  }

  prepareTab(tab: Tab): TabPlumbing {
    const tabPlumbing = new TabPlumbing(this, tab);
    this.#allTabs.push(tabPlumbing);
    return tabPlumbing;
  }

  disposeTabPlumbing(tabPlumbing: TabPlumbing): void {
    this.#allTabs.splice(this.#allTabs.indexOf(tabPlumbing), 1);
  }

  getSafeWindowTabs(window: Window): Tab[] {
    // This is a work around for some flakey behaviour in QADS where a
    // `FloatingDockContainer` keeps its tabs during event firing when it
    // is being destroyed and its tabs redistributed to other windows.
    // Really, these references to tabs it no longer should own, should
    // have been removed from the `FloatingDockContainer` instance.
    // They're 'ghost' pointers.

    const windowTabs = this.#getWindowTabs(window);

    const otherTabs = new Set<Tab>();
    for (const w of this.#allWindows) {
      if (w !== window) {
        for (const tab of this.#getWindowTabs(w)) {
          otherTabs.add(tab);
        }
      }
    }

    // Remove any tabs which also appear to belong to other windows.
    return windowTabs.filter(t => ! otherTabs.has(t));
  }

  #getWindowTabs(window: Window): Tab[] {
    const result: Tab[] = [];
    for (const dockWidget of window.dockContainer.dockWidgets()) {
      const plumbing = this.getTabPlumbingForDockWidget(dockWidget);
      if (plumbing != null) {
        result.push(plumbing.tab);
      }
    }
    return result;
  }

  moveTabIntoFloatingWindow(tab: Tab): void {
    const plumbing = this.getTabPlumbingForTab(tab);
    this.#dockManager.addDockWidgetFloating(plumbing.dockWidget);
  }
}

export interface PopOutClickedDetails {
  window: Window;
  frame: DecoratedFrame;
  terminal: Terminal;
}

function createWindowIcon(): QIcon {
  const windowIcon = new QIcon();
  for (const size of [16, 22, 32, 64, 256]) {
    const iconPath = path.join(SourceDir.path, `../resources/logo/extraterm_small_logo_${size}x${size}.png`);
    windowIcon.addFile(iconPath, new QSize(size, size));
  }
  return windowIcon;
}

class TabPlumbing implements Disposable {
  private _log: Logger = null;

  tab: Tab = null;
  #windowManager: WindowManager = null;
  #disposableHolder = new DisposableHolder();
  titleLabel: QLabel = null;
  titleWidget: QWidget = null;
  dockWidget: CDockWidget = null;

  constructor(windowManager: WindowManager, tab: Tab) {
    this._log = getLogger("TabPlumbing", this);
    this.#windowManager = windowManager;
    this.tab = tab;

    const dockWidget = new CDockWidget(tab.getWindowTitle());
    dockWidget.setFeature(DockWidgetFeature.CustomCloseHandling, true);
    dockWidget.setWidget(tab.getContents());
    const tabWidget = dockWidget.tabWidget();

    this.dockWidget = dockWidget;

    if (tab instanceof Terminal) {
      this.#disposableHolder.add(tab.onContextMenu((ev: ContextMenuEvent) => {
        const window = this.#windowManager.getWindowForTab(tab);
        window.openContextMenu(ev.terminal, ev.blockFrame, ev.x, ev.y);
      }));

      this.#disposableHolder.add(tab.onPopOutClicked((details) => {
        const window = this.#windowManager.getWindowForTab(tab);
        window.tabPopOutClicked(details);
      }));
    }

    this.#disposableHolder.add(tab.onWindowTitleChanged((title: string) => {
      const window = this.#windowManager.getWindowForTab(tab);
      if (window == null) {
        return;
      }
      window.handleTabWindowTitleChanged(tab, title);
    }));

    dockWidget.addEventListener("closeRequested", () => {
      const window = this.#windowManager.getWindowForTab(tab);
      if (window == null) {
        return;
      }
      window.handleTabCloseClicked(tab);
    });

    this.#disposableHolder.add(tab.onWindowTitleChanged((title: string) => {
      this.dockWidget.setWindowTitle(title);
    }));

    tabWidget.addEventListener(WidgetEventTypes.MouseButtonPress, (nativeEvent) => {
      const ev = new QMouseEvent(nativeEvent);
      const window = this.#windowManager.getWindowForTab(tab);
      window.handleTabMouseButtonPress(tab, ev);
    });

    tabWidget.addEventListener(WidgetEventTypes.Wheel, (nativeEvent) => {
      const ev = new QWheelEvent(nativeEvent);
      const hScrollBar = dockWidget.dockAreaWidget().titleBar().tabBar().horizontalScrollBar();
      hScrollBar.setValue(hScrollBar.value() - ev.pixelDelta().y);
    });
  }

  setIsCurrent(isCurrent: boolean): void {
    this.tab.setIsCurrent(isCurrent);
  }

  dispose(): void {
    this.dockWidget.takeWidget();
    this.tab.setParent(null);
    this.dockWidget.deleteDockWidget();
    this.#disposableHolder.dispose();
    this.#windowManager.disposeTabPlumbing(this);
  }
}

enum WindowOpenState {
  Closed,
  Open,
  Minimized,
  ClosedMinimized
}

let windowIdCounter = 0;


class DockAreaMenu {
  private _log: Logger = null;
  #dockAreaWidget: CDockAreaWidget = null;

  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #uiStyle: UiStyle = null;

  #hamburgerMenuButton: QToolButton = null;
  #hamburgerMenu: QMenu = null;
  #tabsMenuButton:QToolButton = null;
  #tabsMenu: QMenu = null;

  constructor(extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager,
    uiStyle: UiStyle, dockAreaWidget: CDockAreaWidget) {

    this._log = getLogger("DockAreaMenu", this);

    this.#dockAreaWidget = dockAreaWidget;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#uiStyle = uiStyle;

    this.#init();
  }

  #init(): void {
    const menu = this.#createHamburgerMenu();
    const titleBar = this.#dockAreaWidget.titleBar();
    const index = titleBar.indexOf(titleBar.button(TitleBarButton.TitleBarButtonTabsMenu));
    titleBar.insertWidget(index + 1, menu);

    const tabsMenu = this.#createTabsMenu();
    titleBar.insertWidget(index + 1, tabsMenu);
  }

  #createHamburgerMenu(): QToolButton {
    const iconPair = this.#uiStyle.getToolbarButtonIconPair("fa-bars");

    this.#hamburgerMenuButton = ToolButton({
      icon: iconPair.normal,
      popupMode: ToolButtonPopupMode.InstantPopup,
      onEnter: () => {
        this.#hamburgerMenuButton.setIcon(iconPair.hover);
      },
      onLeave: () => {
        this.#hamburgerMenuButton.setIcon(iconPair.normal);
      },
      onMouseButtonPress: () => {
        this.#updateHamburgerMenu(this.#uiStyle);
      },
      menu: this.#hamburgerMenu = Menu({
        attribute: [WidgetAttribute.WA_TranslucentBackground],
        onTriggered: (nativeAction) => {
          const action = new QAction(nativeAction);
          this.#handleWindowMenuTriggered(action.data().toString());
        }
      })
    });

    this.#updateHamburgerMenu(this.#uiStyle);

    return this.#hamburgerMenuButton;
  }

  #updateHamburgerMenu(uiStyle: UiStyle): void {
    const options: CommandQueryOptions = {
      when: true,
      windowMenu: true,
    };
    this.#updateMenu(this.#hamburgerMenu, uiStyle, options);
  }

  #updateMenu(menu: QMenu, uiStyle: UiStyle, options: CommandQueryOptions, context?: CommonExtensionWindowState): void {
    menu.clear();

    if (context == null) {
      context = this.#extensionManager.copyExtensionWindowState();
    }
    const entries = this.#extensionManager.queryCommandsWithExtensionWindowState(options, context);
    if (entries.length === 0) {
      return;
    }

    const termKeybindingsMapping = this.#keybindingsIOManager.getCurrentKeybindingsMapping();
    let category = entries[0].category;
    for (const entry of entries) {
      if (entry.category !== category) {
        menu.addSeparator();
        category = entry.category;
      }

      const action = menu.addAction(entry.title);
      action.setData(new QVariant(entry.command));
      action.setShortcutContext(ShortcutContext.WidgetShortcut);
      if (entry.icon != null && entry.icon !== "") {
        const icon = uiStyle.getMenuIcon(entry.icon);
        if (icon != null) {
          action.setIcon(icon);
        }
      }

      const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
      if (shortcuts.length !== 0) {
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        action.setShortcut(new QKeySequence(shortcut));
      }
    }
  }

  #handleWindowMenuTriggered(commandName: string): void {
    doLater( () => {
      try {
        this.#extensionManager.executeCommand(commandName);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }

  #createTabsMenu(): QToolButton {
    const iconPair = this.#uiStyle.getToolbarButtonIconPair("fa-caret-down");

    this.#tabsMenuButton = ToolButton({
      icon: iconPair.normal,
      popupMode: ToolButtonPopupMode.InstantPopup,
      onEnter: () => {
        this.#tabsMenuButton.setIcon(iconPair.hover);
      },
      onLeave: () => {
        this.#tabsMenuButton.setIcon(iconPair.normal);
      },
      onMouseButtonPress: () => {
        this.#updateHamburgerMenu(this.#uiStyle);
      },
      menu: this.#tabsMenu = Menu({
        attribute: [WidgetAttribute.WA_TranslucentBackground],
        onAboutToShow: () => {
          this.#handleTabsMenuAboutToShow();
        },
        onTriggered: (nativeAction) => {
          const action = new QAction(nativeAction);
          this.#handleTabsMenuTriggered(action.data().toInt());
        }
      })
    });
    return this.#tabsMenuButton;
  }

  #handleTabsMenuAboutToShow(): void {
    this.#tabsMenu.clear();
    const tabBar = this.#dockAreaWidget.titleBar().tabBar();

    for (let i = 0; i < tabBar.count(); ++i) {
      if (!tabBar.isTabOpen(i)) {
        continue;
      }

      const tab = tabBar.tab(i);
      const action = new QAction();
      action.setText(tab.text());
      this.#tabsMenu.addAction(action);
      action.setData(new QVariant(i));
    }
  }

  #handleTabsMenuTriggered(index: number): void {
    this.#dockAreaWidget.setCurrentIndex(index);
  }
}


export class Window implements Disposable {
  private _log: Logger = null;
  #id = 0;
  #windowManager: WindowManager = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;

  #disposables: DisposableHolder = null;
  #dockContainerEventHolder: DisposableEventHolder<CFloatingDockContainerSignals> = null;

  #windowOpenState = WindowOpenState.Closed;
  dockContainer: CFloatingDockContainer = null;
  #initialEmptyState = true;

  #windowHandle: QWindow = null;
  #screen: QScreen = null;
  #lastConfigDpi = -1;
  #lastConfigDpr = -1;

  #contextMenu: QMenu = null;

  #terminalVisualConfig: TerminalVisualConfig = null;
  #themeManager: ThemeManager = null;
  #uiStyle: UiStyle = null;

  onTabCloseRequest: Event<Tab> = null;
  #onTabCloseRequestEventEmitter = new EventEmitter<Tab>();

  onTabChange: Event<Tab> = null;
  #onTabChangeEventEmitter = new EventEmitter<Tab>();

  onWindowGeometryChanged: Event<void> = null;
  #onWindowGeometryChangedEventEmitter = new EventEmitter<void>();

  #onPopOutClickedEventEmitter = new EventEmitter<PopOutClickedDetails>();
  onPopOutClicked: Event<PopOutClickedDetails> = null;

  #onWindowDisposeEventEmitter = new EventEmitter<Window>();
  onWindowDispose: Event<Window> = null;

  constructor(windowManager: WindowManager, dockContainer: CFloatingDockContainer, configDatabase: ConfigDatabase,
      extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager, themeManager: ThemeManager,
      uiStyle: UiStyle) {

    this._log = getLogger("Window", this);
    ++windowIdCounter;
    this.#id = windowIdCounter;
    this.#windowManager = windowManager;
    this.dockContainer = dockContainer;
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;

    this.#disposables = new DisposableHolder();
    this.#dockContainerEventHolder = new DisposableEventHolder<CFloatingDockContainerSignals>(dockContainer);
    this.#disposables.add(this.#dockContainerEventHolder);

    this.#handleLogicalDpiChanged = this.#UnboundHandleLogicalDpiChanged.bind(this);

    this.onTabCloseRequest = this.#onTabCloseRequestEventEmitter.event;
    this.onTabChange = this.#onTabChangeEventEmitter.event;
    this.onWindowGeometryChanged = this.#onWindowGeometryChangedEventEmitter.event;
    this.onPopOutClicked = this.#onPopOutClickedEventEmitter.event;
    this.onWindowDispose = this.#onWindowDisposeEventEmitter.event;
  }

  async init(): Promise<void> {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    this.#configDatabase.onChange((event: ConfigChangeEvent) => this.#handleConfigChangeEvent(event));

    this.#dockContainerEventHolder.addEventListener(WidgetEventTypes.KeyPress, (nativeEvent) => {
      this.#handleKeyPress(new QKeyEvent(nativeEvent));
    });

    this.#dockContainerEventHolder.addEventListener(WidgetEventTypes.Close, () => {
      this.#windowOpenState = WindowOpenState.Closed;
    });

    this.dockContainer.setWindowIcon(createWindowIcon());
    this.dockContainer.setMouseTracking(true);
    this.dockContainer.setContextMenuPolicy(ContextMenuPolicy.PreventContextMenu);
    this.dockContainer.setFocusPolicy(FocusPolicy.ClickFocus);

    this.#loadStyleSheet(generalConfig.uiScalePercent/100);

    this.#initContextMenu();

    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();

    this.dockContainer.show();
    this.#windowHandle = this.dockContainer.windowHandle();
    this.#windowHandle.addEventListener("screenChanged", (screen: QScreen) => {
      this.#watchScreen(screen);
      this.#handleDpiAndDprChanged(this.#screen.logicalDotsPerInch(), this.#screen.devicePixelRatio());
    });
    this.#windowHandle.addEventListener("visibilityChanged", (visibility: Visibility) => {
      this.#onWindowGeometryChangedEventEmitter.fire();
    });
    this.#windowHandle.addEventListener(WidgetEventTypes.Move, () => {
      this.#onWindowGeometryChangedEventEmitter.fire();
    });
    this.#windowHandle.addEventListener(WidgetEventTypes.Resize, () => {
      this.#onWindowGeometryChangedEventEmitter.fire();
    });

    this.#windowHandle.addEventListener("windowStateChanged", (windowState: WindowState) => {
      this.#handleWindowStateChanged(windowState);
    });
    this.#windowOpenState = WindowOpenState.Open;

    this.#updateTerminalVisualConfig();
  }

  #loadStyleSheet(uiScale: number): void {
    this.dockContainer.setStyleSheet("", false);
    // this.#hamburgerMenu.setStyleSheet("", false);
    if (process.platform === "darwin") {
      uiScale *= 1.5; // Make everything bigger on macOS to more closely match native apps.
                      // Note: This factor appears in main.ts:#setApplicationStyle too.
    }
    const sheet = this.#uiStyle.getApplicationStyleSheet(uiScale, this.getDpi());
    this.dockContainer.setStyleSheet(sheet, false);
    // this.#hamburgerMenu.setStyleSheet(sheet, false);
  }

  #updateMenu(menu: QMenu, uiStyle: UiStyle, options: CommandQueryOptions, context?: CommonExtensionWindowState): void {
    menu.clear();

    if (context == null) {
      context = this.#extensionManager.copyExtensionWindowState();
    }
    const entries = this.#extensionManager.queryCommandsWithExtensionWindowState(options, context);
    if (entries.length === 0) {
      return;
    }

    const termKeybindingsMapping = this.#keybindingsIOManager.getCurrentKeybindingsMapping();
    let category = entries[0].category;
    for (const entry of entries) {
      if (entry.category !== category) {
        menu.addSeparator();
        category = entry.category;
      }

      const action = menu.addAction(entry.title);
      action.setData(new QVariant(entry.command));
      action.setShortcutContext(ShortcutContext.WidgetShortcut);
      if (entry.icon != null && entry.icon !== "") {
        const icon = uiStyle.getMenuIcon(entry.icon);
        if (icon != null) {
          action.setIcon(icon);
        }
      }

      const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
      if (shortcuts.length !== 0) {
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        action.setShortcut(new QKeySequence(shortcut));
      }
    }
  }

  #initContextMenu(): void {
    this.#contextMenu = Menu({
      attribute: [WidgetAttribute.WA_TranslucentBackground],
      onTriggered: (nativeAction) => {
        const action = new QAction(nativeAction);
        this.#handleContextMenuTriggered(this.#contextMenuState, action.data().toString());
      },
      onClose: () => {
        doLater(() => {
          this.#contextMenuState = null;
        });
      }
    });
    this.#contextMenu.hide();
  }

  openContextMenu(terminal: Terminal, blockFrame: BlockFrame, x: number, y: number): void {
    const options: CommandQueryOptions = {
      when: true,
      contextMenu: true,
    };

    const state = this.#extensionManager.copyExtensionWindowState();
    state.activeTerminal = terminal;
    state.activeBlockFrame = blockFrame;
    this.#contextMenuState = state;
    this.#updateMenu(this.#contextMenu, this.#uiStyle, options, state);

    this.#contextMenu.popup(new QPoint(x, y));
  }

  #contextMenuState: CommonExtensionWindowState = null;

  #handleContextMenuTriggered(context: CommonExtensionWindowState, commandName: string): void {
    doLater( () => {
      try {
        this.#extensionManager.executeCommandWithExtensionWindowState(context, commandName);
        // ^ Let any Promise here run to completion by itself.
        this.#contextMenuState = null;
      } catch(e) {
        this._log.warn(e);
      }
    });
  }

  handleTabMouseButtonPress(tab: Tab, ev: QMouseEvent): void {
    const isContextMenu = ev.button() === MouseButton.RightButton;
    if (!isContextMenu) {
      return;
    }

    this.focusTab(tab);

    ev.accept();
    const options: CommandQueryOptions = {
      when: true,
      terminalTitleMenu: true,
    };
    this.#updateMenu(this.#contextMenu, this.#uiStyle, options);
    this.#contextMenu.popup(new QPoint(ev.globalX(), ev.globalY()));
  }

  handleTabCloseClicked(tab: Tab): void {
    this.#onTabCloseRequestEventEmitter.fire(tab);
  }

  #handleKeyPress(event: QKeyEvent): void {
    const ev = qKeyEventToMinimalKeyboardEvent(event);
    const commands = this.#keybindingsIOManager.getCurrentKeybindingsMapping().mapEventToCommands(ev);
    const filteredCommands = this.#extensionManager.queryCommands({
      commands,
      when: true
    });
    if (filteredCommands.length !== 0) {
      if (filteredCommands.length !== 1) {
        this._log.warn(`Commands ${filteredCommands.map(fc => fc.command).join(", ")} have conflicting keybindings.`);
      }
      try {
        this.#extensionManager.executeCommand(filteredCommands[0].command);
      } catch(ex) {
        this._log.warn(ex);
      }
    }
  }

  async #createTerminalVisualConfig(): Promise<TerminalVisualConfig> {
    const config = this.#configDatabase.getGeneralConfig();
    const fontInfo = this.#getFontInfo(config.terminalFont);
    const terminalTheme = this.#themeManager.getTerminalTheme(config.themeTerminal);

    let ligatureMarker: LigatureMarker = null;
    if (config.terminalDisplayLigatures && fontInfo.path != null) {
      try {
        const plainLigatureMarker = await loadFontFile(fontInfo.path);
        if (plainLigatureMarker != null) {
          ligatureMarker = new CachingLigatureMarker(plainLigatureMarker);
        }
      } catch(ex) {
        this._log.warn(`Unable to read ligature data from font. Error was '${ex.message}'`);
      }
    }

    const transparentBackground = config.windowBackgroundMode !== "opaque";

    const extraFonts: FontSlice[] = [
      {
        fontFamily: TWEMOJI_FAMILY,
        fontSizePx: 16,
        containsCodePoint: hasEmojiPresentation,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }
    ];

    this.#lastConfigDpi = this.getDpi();
    this.#lastConfigDpr = this.getDpr();

    const scaledFontSize = config.terminalFontSize * this.#lastConfigDpr;
    const terminalFontSizePx = Math.round(this.#pointsToPx(scaledFontSize, this.#lastConfigDpi));

    const terminalVisualConfig: TerminalVisualConfig = {
      cursorStyle: config.cursorStyle,
      cursorBlink: config.blinkingCursor,
      fontInfo,
      fontSizePt: config.terminalFontSize,
      fontSizePx: terminalFontSizePx,
      extraFonts,
      palette: this.#extractPalette(terminalTheme, transparentBackground),
      terminalTheme,
      transparentBackground,
      useLigatures: config.terminalDisplayLigatures,
      ligatureMarker,
      windowDpr: this.getDpr(),
      screenHeightHintPx: 1024, // FIXME
      screenWidthHintPx: 1024,  // FIXME
    };
    return terminalVisualConfig;
  }

  getId(): number {
    return this.#id;
  }

  getDpi(): number {
    const window = this.dockContainer;
    const screen = window.isVisible() ? window.windowHandle().screen() : QApplication.primaryScreen();
    return screen.logicalDotsPerInch();
  }

  getDpr(): number {
    const window = this.dockContainer;
    const screen = window.isVisible() ? window.windowHandle().screen() : QApplication.primaryScreen();
    return screen.devicePixelRatio();
  }

  async #handleConfigChangeEvent(event: ConfigChangeEvent): Promise<void> {
    if (event.key !== GENERAL_CONFIG) {
      return;
    }
    const oldConfig = <GeneralConfig> event.oldConfig;
    const newConfig = <GeneralConfig> event.newConfig;

    if (oldConfig.uiScalePercent !== newConfig.uiScalePercent) {
      this.#loadStyleSheet(newConfig.uiScalePercent / 100);
    }

    if (!(oldConfig.terminalFont === newConfig.terminalFont &&
        oldConfig.terminalFontSize === newConfig.terminalFontSize &&
        oldConfig.cursorStyle === newConfig.cursorStyle &&
        oldConfig.themeTerminal === newConfig.themeTerminal &&
        oldConfig.terminalDisplayLigatures === newConfig.terminalDisplayLigatures &&
        oldConfig.terminalMarginStyle === newConfig.terminalMarginStyle)) {
      await this.#updateTerminalVisualConfig();
    }

    if (oldConfig.titleBarStyle !== newConfig.titleBarStyle) {
      // this.#setWindowFrame(newConfig.titleBarStyle);
    }

    if (oldConfig.minimizeToTray !== newConfig.minimizeToTray) {
      if (newConfig.minimizeToTray && newConfig.showTrayIcon) {
        this.#convertToMinimizeToTray();
      }
      if ( ! newConfig.minimizeToTray) {
        this.#convertToNormalMinimize();
      }
    }
  }

  async #updateTerminalVisualConfig(): Promise<void> {
    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
    for (const tab of this.#getTabs()) {
      if (tab instanceof Terminal) {
        tab.setTerminalVisualConfig(this.#terminalVisualConfig);
      }
      if (tab instanceof SettingsTab) {
        tab.setTerminalVisualConfig(this.#terminalVisualConfig);
      }
    }
  }

  #extractPalette(terminalTheme: TerminalTheme, transparentBackground: boolean): number[] {
    const palette = this.#extractPaletteFromTerminalVisualConfig(terminalTheme);
    if (transparentBackground) {
      palette[256] = 0x00000000;
    }
    return palette;
  }

  #extractPaletteFromTerminalVisualConfig(terminalTheme: TerminalTheme): number[] {
    const result: number[] = [];
    for (let i=0; i<256; i++) {
      result.push(cssHexColorToRGBA(terminalTheme[i]));
    }

    result.push(cssHexColorToRGBA(terminalTheme.backgroundColor));
    result.push(cssHexColorToRGBA(terminalTheme.foregroundColor));
    result.push(cssHexColorToRGBA(terminalTheme.cursorBackgroundColor));

    return result;
  }

  #pointsToPx(point: number, dpi: number): number {
    return point * dpi / 72;
  }

  #getFontInfo(fontId: string): FontInfo {
    const systemConfig = this.#configDatabase.getSystemConfig();
    for (const fontInfo of systemConfig.availableFonts) {
      if (fontInfo.id === fontId) {
        return fontInfo;
      }
    }
    return null;
  }

  open(): void {
    this.dockContainer.show();
    this.#moveOnScreen();
  }

  #moveOnScreen(): void {
    const screenGeometry = this.dockContainer.windowHandle().screen().geometry();
    const windowGeometry = this.dockContainer.geometry();

    let changed = false;
    let windowWidth = windowGeometry.width();
    if (windowWidth > screenGeometry.width()) {
      windowWidth = screenGeometry.width();
      changed = true;
    }

    let windowHeight = windowGeometry.height();
    if (windowHeight > screenGeometry.height()) {
      windowHeight = screenGeometry.height();
      changed = true;
    }

    let windowLeft = windowGeometry.left();
    if (windowLeft < 0) {
      windowLeft = 0;
      changed = true;
    }
    if (windowLeft > screenGeometry.width() - windowWidth) {
      windowLeft = screenGeometry.width() - windowWidth;
    }

    let windowTop = windowGeometry.top();
    if (windowTop < 0) {
      windowTop = 0;
      changed = true;
    }
    if (windowTop > screenGeometry.height() - windowHeight) {
      windowTop = screenGeometry.height() - windowHeight;
      changed = true;
    }

    if (changed) {
      this.dockContainer.setGeometry(windowLeft, windowTop, windowWidth, windowHeight);
    }
  }

  dispose(): void {
    // Terminate any running terminal tabs.
    for (const tab of this.#getTabs()) {
      this.removeTab(tab);
      if (tab instanceof Terminal) {
        tab.dispose();
      }
    }
    this.#onWindowDisposeEventEmitter.fire(this);
    this.#disposables.dispose();
  }

  isMaximized(): boolean {
    return this.#windowHandle.visibility() === Visibility.Maximized;
  }

  maximize(): void {
    this.dockContainer.showMaximized();
    this.#windowOpenState = WindowOpenState.Open;
  }

  minimize(): void {
    const config = this.#configDatabase.getGeneralConfig();
    if (config.showTrayIcon && config.minimizeToTray) {
      this.dockContainer.hide();
      this.#windowOpenState = WindowOpenState.ClosedMinimized;
    } else {
      this.dockContainer.showMinimized();
      this.#windowOpenState = WindowOpenState.Minimized;
    }
  }

  isMinimized(): boolean {
    return this.#windowOpenState === WindowOpenState.Minimized || this.#windowOpenState === WindowOpenState.ClosedMinimized;
  }

  restore(): void {
    this.dockContainer.hide();
    this.dockContainer.show();
    this.dockContainer.showNormal();

    for (const dockWidget of this.dockContainer.dockWidgets()) {
      dockWidget.toggleView(true);
    }

    this.#windowOpenState = WindowOpenState.Open;
  }

  raise(): void {
    this.dockContainer.activateWindow();
    this.dockContainer.raise();
  }

  #convertToMinimizeToTray(): void {
    if (this.#windowOpenState === WindowOpenState.Minimized) {
      this.dockContainer.hide();
      this.#windowOpenState = WindowOpenState.ClosedMinimized;
    }
  }

  #convertToNormalMinimize(): void {
    if (this.#windowOpenState === WindowOpenState.ClosedMinimized) {
      this.dockContainer.showMinimized();
      this.#windowOpenState = WindowOpenState.Minimized;
    }
  }

  #handleWindowStateChanged(windowState: WindowState): void {
    if (windowState === WindowState.WindowMinimized) {
      const config = this.#configDatabase.getGeneralConfig();
      if (config.showTrayIcon && config.minimizeToTray) {
        this.dockContainer.hide();
        this.#windowOpenState = WindowOpenState.ClosedMinimized;
      } else {
        this.#windowOpenState = WindowOpenState.Minimized;
      }
    }
  }

  getGeometry(): QRect {
    return this.dockContainer.geometry();
  }

  #handleLogicalDpiChanged: (dpi: number) => void;

  #UnboundHandleLogicalDpiChanged(dpi: number): void {
    this.#handleDpiAndDprChanged(dpi, this.#screen.devicePixelRatio());
  }

  #handleDpiAndDprChanged(dpi: number, dpr: number): void {
    if (dpi !== this.#lastConfigDpi || dpr !==this.#lastConfigDpr) {
      this.#updateTerminalVisualConfig();
    }
  }

  #watchScreen(screen: QScreen): void {
    if (this.#screen != null) {
      this.#screen.removeEventListener("logicalDotsPerInchChanged",  this.#handleLogicalDpiChanged);
    }

    this.#screen = screen;
    this.#screen.addEventListener("logicalDotsPerInchChanged",  this.#handleLogicalDpiChanged);
  }

  isActiveWindow(): boolean {
    return this.dockContainer.isActiveWindow();
  }

  getWidget(): QWidget {
    return this.dockContainer;
  }

  setCurrentTabIndex(index: number): void {
    const tabs = this.#getTabs();
    const noTabs = tabs.length === 0;
    if (noTabs) {
      this.#onTabChangeEventEmitter.fire(null);
      return;
    }

    const currentIndex = this.getCurrentTabIndex();
    tabs[currentIndex].unfocus();

    for (let i=0; i<tabs.length; i++) {
      const tab = tabs[i];
      const tabPlumbing = this.#windowManager.getTabPlumbingForTab(tab);
      tabPlumbing.setIsCurrent(i === index);
    }
    const currentTab = tabs[index];

    const tabPlumbing = this.#windowManager.getTabPlumbingForTab(currentTab);
    tabPlumbing.dockWidget.setAsCurrentTab();

    currentTab.focus();

    this.#onTabChangeEventEmitter.fire(currentTab);
  }

  handleTabFocusChanged(tab: Tab): void {
    if (tab != null) {
      tab.focus();
    }
    this.#onTabChangeEventEmitter.fire(tab);
  }

  #getTabs(): Tab[] {
    return this.#windowManager.getSafeWindowTabs(this);
  }

  getCurrentTabIndex(): number {
    let currentTab: Tab = null;
    const tabs = this.#getTabs();

    if (this.#extensionManager.getActiveWindow() === this) {
      currentTab = this.#extensionManager.getActiveTab();
    } else {
      for (const tab of tabs) {
        const plumbing = this.#windowManager.getTabPlumbingForTab(tab);
        if (plumbing.dockWidget.isCurrentTab()) {
          currentTab = tab;
          break;
        }
      }
    }
    return currentTab == null ? 0 : tabs.indexOf(currentTab);
  }

  getTabCount(): number {
    return this.#getTabs().length;
  }

  getTab(index: number): Tab {
    return this.#getTabs()[index];
  }

  addTab(tab: Tab, preTabHeader?: () => void): void {
    if (this.#windowManager.hasTab(tab)) {
      return;
    }
    this.#initialEmptyState = false;

    const tabPlumbing = this.#windowManager.prepareTab(tab);
    tab.setParent(this);

    if (tab instanceof Terminal) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    }
    if (tab instanceof SettingsTab) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    }

    let dockAreaWidget: CDockAreaWidget = null;
    const currentTab = this.#extensionManager.getActiveTab();
    if (this.#extensionManager.getActiveWindow() === this && currentTab != null) {
      const plumbing = this.#windowManager.getTabPlumbingForTab(currentTab);
      dockAreaWidget = plumbing.dockWidget.dockAreaWidget();
    } else {
      dockAreaWidget = this.dockContainer.dockContainer().dockArea(0);
    }

    CDockManager.setFloatingContainersTitle(tab.getTitle() ?? "ExtratermQt");
    this.#windowManager.getDockManager().addDockWidgetTabToArea(tabPlumbing.dockWidget, dockAreaWidget);

    if (preTabHeader != null) {
      preTabHeader();
    }

    let tabTitleWidget = tab.getTabWidget();
    if (tabTitleWidget == null) {
      const iconName = tab.getIconName();
      const iconHtml = iconName != null ? createHtmlIcon(iconName) + "  " : "";
      const titleHtml = `${iconHtml}${he.escape(tab.getTitle() ?? "")}`;
      tabPlumbing.titleLabel = Label({
        cssClass: ["tab-title"],
        contentsMargins: [8, 0, 0, 0],
        text: titleHtml,
        textFormat: TextFormat.RichText,
        textInteractionFlag: TextInteractionFlag.NoTextInteraction,
      });
      tabTitleWidget = tabPlumbing.titleLabel;
    }
    tabPlumbing.titleWidget = tabTitleWidget;

    const tabWidget = tabPlumbing.dockWidget.tabWidget();
    const layout = <QBoxLayout> tabWidget.layout();
    layout.insertWidget(0, tabPlumbing.titleWidget);
    tabPlumbing.setIsCurrent(true);
  }

  tabPopOutClicked(details: {frame: DecoratedFrame, terminal: Terminal}): void {
    this.#onPopOutClickedEventEmitter.fire({
      window: this,
      terminal: details.terminal,
      frame: details.frame
    });
  }

  handleTabWindowTitleChanged(tab: Tab, title: string): void {
    // TODO: Should this just be moved into TabPlumbing directly?
    const tabPlumbing = this.#windowManager.getTabPlumbingForTab(tab);
    tabPlumbing.dockWidget.setWindowTitle(title);
  }

  hasTab(targetTab: Tab): boolean {
    for (const dockWidget of this.dockContainer.dockWidgets()) {
      const plumbing = this.#windowManager.getTabPlumbingForDockWidget(dockWidget);
      if (plumbing != null && plumbing.tab === targetTab) {
        return true;
      }
    }
    return false;
  }

  focus(): void {
    this.dockContainer.setFocus();
    this.dockContainer.raise();
  }

  removeTab(targetTab: Tab): void {
    const tabPlumbing = this.#windowManager.getTabPlumbingForTab(targetTab);
    if (tabPlumbing == null) {
      return;
    }

    if (this.#extensionManager.getActiveTab() === targetTab) {
      if (this.getTabCount()=== 1) {
        this.#extensionManager.setActiveTab(null);
      } else {
        const nextTab = this.getTab(Math.max(this.getCurrentTabIndex()-1, 0));
        this.focusTab(nextTab);
      }
    }

    tabPlumbing.dispose();
  }

  focusTab(tab: Tab): void {
    const tabPlumbing = this.#windowManager.getTabPlumbingForTab(tab);
    tabPlumbing.dockWidget.dockAreaWidget().setCurrentDockWidget(tabPlumbing.dockWidget);
    tab.focus();
    // FIXME: update any context related state
  }

  getTabGlobalGeometry(tab: Tab): QRect {
    const tabPlumbing = this.#windowManager.getTabPlumbingForTab(tab);
    const localGeometry = tabPlumbing.dockWidget.geometry();
    const topLeftGlobal = tabPlumbing.dockWidget.mapToGlobal(new QPoint(0, 0));
    return new QRect(topLeftGlobal.x(), topLeftGlobal.y(), localGeometry.width(), localGeometry.height());
  }

  getWindowGlobalGeometry(): QRect {
    const localGeometry = this.dockContainer.geometry();
    const topLeftGlobal = this.dockContainer.mapToGlobal(new QPoint(0, 0));
    return new QRect(topLeftGlobal.x(), topLeftGlobal.y(), localGeometry.width(), localGeometry.height());
  }

  getTerminals(): Terminal[] {
    const result: Terminal[] = [];
    for (const dockWidget of this.dockContainer.dockWidgets()) {
      const plumbing = this.#windowManager.getTabPlumbingForDockWidget(dockWidget);
      if (plumbing != null && plumbing.tab instanceof Terminal) {
        result.push(plumbing.tab);
      }
    }
    return result;
  }

  getUiStyle(): UiStyle {
    return this.#uiStyle;
  }

  #focusPaneInDirection(direction: Direction): void {
    const activeTabPlumbing = this.#getCurrentTabPlumping();
    if (activeTabPlumbing == null) {
      return;
    }
    const dockArea = nextDockAreaInDirection(activeTabPlumbing.dockWidget.dockAreaWidget(),
      this.dockContainer.dockContainer(), direction);
    if (dockArea == null) {
      return;
    }
    dockArea.currentDockWidget().setFocus();
  }

  focusPaneLeft(): void {
    this.#focusPaneInDirection(Direction.LEFT);
  }
  focusPaneRight(): void {
    this.#focusPaneInDirection(Direction.RIGHT);
  }
  focusPaneAbove(): void {
    this.#focusPaneInDirection(Direction.ABOVE);
  }
  focusPaneBelow(): void {
    this.#focusPaneInDirection(Direction.BELOW);
  }

  #split(panePosition: DockWidgetArea): void {
    const activeTabPlumbing = this.#getCurrentTabPlumping();
    if (activeTabPlumbing == null) {
      return;
    }
    activeTabPlumbing.dockWidget.dockContainer().addDockWidget(panePosition,
      this.#windowManager.createEmptyDockWidget());
  }

  horizontalSplit(): void {
    this.#split(DockWidgetArea.BottomDockWidgetArea);
  }

  verticalSplit(): void {
    this.#split(DockWidgetArea.RightDockWidgetArea);
  }

  #getCurrentTabPlumping(): TabPlumbing {
    if (this.#extensionManager.getActiveWindow() === this) {
      const currentTab = this.#extensionManager.getActiveTab();
      return this.#windowManager.getTabPlumbingForTab(currentTab);
    } else {
      return null;
    }
  }
}

function cssHexColorToRGBA(cssColor: string): number {
  const color = new Color(cssColor);
  return color.toRGBA();
}
