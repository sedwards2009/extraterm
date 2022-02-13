/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QBoxLayout, QLabel, QPushButton, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Label, PushButton, PushButtonOptions, Widget } from "qt-construct";
import { IconPair, UiStyle } from "./UiStyle";

export interface CompactGroupOptions {
  children: (QWidget | string)[];
}

/**
 * Visually group a bunch of widgets
 *
 * Strings are turned into labels
 */
export function makeGroupLayout(...children: (QWidget | string)[]): QBoxLayout {
  const expandedChildren: QWidget[] = children.map((c): QWidget => {
    if ((typeof c) === "string") {
      return Label({text: <string>c});
    } else {
      return <QWidget>c;
    }
  });

  const lastIndex = expandedChildren.length - 1;
  expandedChildren.forEach((child, index) => {
    const clazz = index === 0 ? "group-left" : (index === lastIndex ? "group-right" : "group-middle");
    const previousClasses = child.property("cssClass").toStringList();
    child.setProperty("cssClass", [...previousClasses, clazz]);
  });

  return BoxLayout({
    direction: Direction.LeftToRight,
    spacing: 0,
    contentsMargins: [0, 0, 0, 0],
    children: [...expandedChildren, {
      widget: Widget({}),
      stretch: 1
    }]
  });
}

export interface LinkLabelOptions {
  onLinkActivated?: (url: string) => void;
  openExternalLinks?: boolean;
  text: string;
  uiStyle: UiStyle;
  wordWrap?: boolean;
}

/**
 * Create a QLabel which looks like a HTML link.
 *
 * Contents are rich text and the link responds to hover correctly.
 */
export function makeLinkLabel(options: LinkLabelOptions): QLabel {
  const { onLinkActivated, openExternalLinks, text, uiStyle, wordWrap } = options;
  const normalText = `${uiStyle.getLinkLabelCSS()}${text}`;
  const hoverText = `<span class="hover">${normalText}</span>`;
  const label = Label({
    text: normalText,
    onLinkActivated,
    openExternalLinks,
    textFormat: TextFormat.RichText,
    onEnter: () => label.setText(hoverText),
    onLeave: () => label.setText(normalText),
    wordWrap
  });
  return label;
}

export interface SubTabBarOptions {
  onCurrentChanged?: (index: number) => void;
  tabs: string[];
}

/**
 * Make a tab bar for use inside page content.
 */
export function makeSubTabBar(options: SubTabBarOptions): QWidget {
  const selectTab = (selectIndex: number) => {
    for (const [index, tabWidget] of tabWidgets.entries()) {
      const classes = tabWidget.property("cssClass").toStringList();
      const newClasses = classes.filter(className => className !== "selected");
      if (index === selectIndex) {
        newClasses.push("selected");
      }

      tabWidget.setProperty("cssClass", newClasses);
      const style = tabWidget.style();
      style.unpolish(tabWidget);
      style.polish(tabWidget);
    }
  };

  const tabWidgets = options.tabs.map((label: string, index: number): QPushButton => {
    return PushButton({
      cssClass: ["subtabbar-tab"],
      text: label,
      onClicked: () => {
        selectTab(index);
        if (options.onCurrentChanged !== undefined) {
          options.onCurrentChanged(index);
        }
      }
    });
  });
  selectTab(0);

  return Widget({
    layout: BoxLayout({
      direction: Direction.LeftToRight,
      contentsMargins: [0, 0, 0, 0],
      spacing: 0,
      children: tabWidgets
    })
  });
}

/**
 * Wrap a widget in a box layout and make use minimal space.
 */
export function shrinkWrap(widget: QWidget): QBoxLayout {
  return BoxLayout({
    direction: Direction.LeftToRight,
    spacing: 0,
    contentsMargins: [0, 0, 0, 0],
    children: [
      widget,
      { widget: Widget({}), stretch: 1 }
    ]
  });
}

interface HoverPushButtonOptions extends PushButtonOptions {
  iconPair: IconPair;
}

export function HoverPushButton(options: HoverPushButtonOptions): QPushButton {
  const { onEnter, onLeave, iconPair } = options;
  let button: QPushButton = null;

  const refinedOptions = { ...options,
    icon: options.iconPair.normal,
    onEnter: () => {
      button.setIcon(iconPair.hover);
      if (onEnter !== undefined) {
        onEnter();
      }
    },
    onLeave: () => {
      button.setIcon(iconPair.normal);
      if (onLeave !== undefined) {
        onLeave();
      }
    }
  };

  button = PushButton(refinedOptions);
  return button;
}
