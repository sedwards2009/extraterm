/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon } from "@nodegui/nodegui";
import { alpha, blue, change, darken, green, hsl, lighten, lightness, mix, red, rgba, saturate, toHex } from "khroma";
import { createIcon } from "../Icons";

import { IconPair, UiStyle } from "../UiStyle";

function toRgba(color: string): number {
  return (red(color) << 24) | (green(color) << 16) | (blue(color) << 8) | 0xff;
}

export function createUiStyle(resourceDirectory: string): UiStyle {
  let styleTextColor = "";
  let styleDropdownLinkHoverColor = "";
  let StyleLinkLabelCSS;
  let StyleHTMLCSS;
  let styleBackgroundColor = "";
  let styleTextHighlightColor = "";
  let styleBrandSuccess = "";
  let styleBrandDanger = "";

  function DarkTwoStyleSheet(resourceDirectory: string, guiScale: number, dpi: number): string {
    const base100PercentFontSize = 9;
    const fontSizeBase = Math.round(base100PercentFontSize * guiScale);
    const fontSizeSmall = Math.round(fontSizeBase * 0.9);

    const uiFg = "#9da5b4";
    const accentBgColor = "hsl(219,  79%, 66%)";
    const uiBg = "#282c34";
    const uiBorder = "#181a1f";

    const headingsColor = "#ffffff";
    const accentColor = "#578af2";

    const level1Color = toHex(lighten(uiBg, 6));
    const level2Color = uiBg;
    const level3Color = toHex(darken(uiBg, 3));

    const textColor = uiFg;
    styleTextColor = textColor;

    const textColorSubtle = change(textColor, { a: alpha(textColor) - 0.4});
    const textMinorColor = darken(textColor, 20);
    const textHighlightColor = toHex(lighten(textColor, 20));
    styleTextHighlightColor = textHighlightColor;
    const textSelectedColor = "#ffffff";
    const backgroundHighlightColor = rgba(255, 255, 255, 0.07);

    // Background color for `<body>`.
    const backgroundColor = uiBg;
    styleBackgroundColor = backgroundColor;
    const backgroundSelectedColor = accentBgColor;

    // const textColorSubtle = "rgba(157, 165, 180, 0.6)";

    const textMutedColor = mix(textColor, backgroundColor, 75);

    const brandPrimary = "hsl(219,  79%, 66%)";
    const brandSuccess = "hsl(140,  44%, 62%)";
    styleBrandSuccess = brandSuccess;
    const brandInfo = "hsl(219,  79%, 66%)";
    const brandWarning = "hsl( 36,  60%, 72%)";
    const brandDanger = "hsl(  9, 100%, 64%)";
    styleBrandDanger = brandDanger;

    const backgroundPrimaryColor = accentBgColor;
    const backgroundSuccessColor = "hsl(132, 58%, 40%)";
    const backgroundInfoColor = "hsl(208, 88%, 48%)";
    const backgroundWarningColor = "hsl( 42, 88%, 36%)";
    const backgroundDangerColor = "hsl(  5, 64%, 50%)";

    const brandTextPrimary = "#ffffff";
    const brandTextSuccess = "#ffffff";
    const brandTextInfo = "#ffffff";
    const brandTextWarning = "#ffffff";
    const brandTextDanger = "#ffffff";

    const baseBorderColor = uiBorder;


    //-------------------------------------------------------------------------
    // Links

    // Global textual link color.
    const linkColor = brandPrimary;
    // Link hover color set via `darken()` function.
    const linkHoverColor = darken(linkColor, 15);
    // Link hover decoration.
    const linkHoverDecoration = "underline";

    //-------------------------------------------------------------------------
    //  Buttons
    const componentBackgroundColor = textColorSubtle;

    const componentPaddingVertical = "1em";

    const borderRadius = "4px";
    const borderRadiusSmall = "3px";
    const buttonFontWeight = "normal";

    const buttonBorderRadius = borderRadius;
    const buttonBorderRadiusSmall = borderRadiusSmall;

    const buttonFontSize = fontSizeBase;
    const buttonFontSizeSmall = fontSizeSmall;


    // $button-line-height:                  $component-line-height !default;
    // $button-line-height-small:            $component-line-height-small !default;
    // $button-padding-vertical:             0.8rem !default;
    // $button-padding-vertical-small:       0.4rem !default;
    // $button-padding-horizontal:           0.8rem !default;
    // $button-padding-horizontal-small:     0.5rem !default;

    const buttonBorderWidth = "1px";
    const buttonBorderWidthSmall = "1px";

    const buttonDefaultColor = textColor;
    const buttonDefaultBgColor = level1Color;
    const buttonDefaultBorderColor = baseBorderColor;
    const buttonDefaultTextSelectedColor = buttonDefaultColor;
    const buttonDefaultBgHoverColor= lighten(buttonDefaultBgColor, 2);
    const buttonDefaultBgSelectedColor = accentBgColor;

    const buttonPrimaryColor = textColor;
    const buttonPrimaryBgColor = backgroundPrimaryColor;
    const buttonPrimaryBorderColor = darken(buttonPrimaryBgColor, 5);

    const buttonSuccessColor = textColor;
    const buttonSuccessBgColor = backgroundSuccessColor;
    const buttonSuccessBorderColor = darken(buttonSuccessBgColor, 5);

    const buttonInfoColor = textColor;
    const buttonInfoBgColor = backgroundInfoColor;
    const buttonInfoBorderColor = darken(buttonInfoBgColor, 5);

    const buttonWarningColor = textColor;
    const buttonWarningBgColor = backgroundWarningColor;
    const buttonWarningBorderColor = darken(buttonWarningBgColor, 5);

    const buttonDangerColor = textColor;
    const buttonDangerBgColor = backgroundDangerColor;
    const buttonDangerBorderColor =  darken(buttonDangerBgColor, 5);

    //-------------------------------------------------------------------------
    // Inputs
    const inputFontSize = "1.2em";
    const inputBackgroundColor = darken(backgroundColor, 6);
    const inputBorderColor = baseBorderColor;
    const inputPaddingVertical = "0.25em";
    const inputPaddingHorizontal = "0.5em";
    const inputBorderWidth = "1px";
    const inputActiveBgColor = mix(accentBgColor, inputBackgroundColor, 10);

    const btnBorder = `1px solid ${buttonDefaultBorderColor}`;

    const groupTextBgColor = buttonDefaultBgColor;
    const dropdownBgColor = level3Color;
    const dropdownLinkHoverColor = textSelectedColor;
    styleDropdownLinkHoverColor = dropdownLinkHoverColor;
    const dropdownLinkHoverBg = backgroundSelectedColor;
    const dropdownBorder = baseBorderColor;

    const overlayBorderColor = backgroundHighlightColor;


    const navLinkPadding = "0.5em 0.75em 0.5em 0em";
    // Hack because padding-left doesn't seem to work for unselected list item.
    // See https://forum.qt.io/topic/87208/strange-stylesheet-behavior-with-qlistview-item/14
    const navLinkPaddingLeft = "0.5em";

    const tabBorderColor = baseBorderColor;
    const tabBackgroundColor = level3Color;
    const tabTextColor = textColorSubtle;

    const tabTextColorActive = textHighlightColor;
    const tabBackgroundColorActive = level2Color;

    //-------------------------------------------------------------------------
    // Tables
    const tableCellPaddingVertical = "0.5em";
    const tableBorderColor = baseBorderColor;


    const settingsBgSelectedColor = lighten(backgroundColor, 8);

    //-------------------------------------------------------------------------
    // Badge
    const badgeFontWeight = "bold";
    const badgeFontRatio = 0.6;
    const badgeFontSize = `${Math.round(fontSizeBase * badgeFontRatio)}em`;
    const badgeVerticalPadding = "0.1em";
    const badgeHorizontalPadding = "0.1em";
    // const badgeLineHeight:             1 !default;
    const badgeBorderRadius = "0.5em";
    const badgeBackgroundColor = lighten(backgroundHighlightColor, 6);
    const badgeColor = textHighlightColor;
    // const badgeVerticalAlign:          1/$badge-font-ratio * $badge-vertical-padding !default;

    // --- Extension Card related ---
    const componentPaddingVerticalCard = "0.66em";
    const componentPaddingHorizontal = "1.2em";
    const componentPaddingHorizontalCard = "0.66em";
    const borderRadius2x = "8px";
    const toolPanelBackgroundColor = level3Color;
    const packageCardBackgroundColor = lighten(toolPanelBackgroundColor, 8);

    function ptToPx(points: number): number {
      return points * dpi / 72;
    }

    function BodyStyleSheet(): string {
      return `
  * {
    color: ${textColor};
    font-size: ${fontSizeBase}pt;
  }
  `;
    }

    function IncludeDefaultBackground(): string {
      return `
      background-color: ${backgroundColor};
  `;
    }

    function QCheckBoxStyleSheet(resourceDirectory: string): string {
      return `
  QCheckBox::indicator {
    border-radius: ${borderRadius};
    width: 1em;
    height: 1em;

    background-color: ${componentBackgroundColor};
  }

  QCheckBox::indicator:checked {
    background-color: ${brandInfo};
    image: url(${resourceDirectory}/checkbox_checked.svg);
  }

  QCheckBox::indicator:pressed {
    background-color: #6494ed;
  }
  `;
    }

    function QComboBoxStyleSheet(resourceDirectory: string): string {
      return `
  QComboBox {
    background-color: ${inputBackgroundColor};
    color: ${textColor};

    padding: 0.25em 0.5em;

    border: ${inputBorderWidth} solid ${inputBorderColor};
    border-radius: ${borderRadius};

    selection-color: #d7dae0;
    selection-background-color: #578af2;
  }

  QComboBox:hover, QComboBox:on {
    color: ${textHighlightColor};
  }

  QComboBox:focus {
    border-color: ${accentColor};
  }

  QComboBox::drop-down {
    subcontrol-origin: padding;
    subcontrol-position: top right;

    border-left-width: 0px;
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
  }

  QComboBox QAbstractItemView {
    selection-background-color: #578af2;
    background-color: #3a404b;
    color: ${textHighlightColor};
    border: 1px solid ${dropdownBorder};
  }

  QComboBox::down-arrow {
    image: url(${resourceDirectory}/combobox_arrow.svg);
  }

  QComboBox::down-arrow:hover {
    image: url(${resourceDirectory}/combobox_arrow_hover.svg);
  }

  QComboBox[cssClass~="warning"] {
    border: ${inputBorderWidth} solid ${brandWarning};
  }

  `;
    }

    function QLabelStyleSheet(): string {
      const h1FontSizePt = Math.round(2 * fontSizeBase);
      const h2FontSizePt = Math.round(1.75 * fontSizeBase);
      const h3FontSizePt = Math.round(1.4 * fontSizeBase);
      const h4FontSizePt = Math.round(1.1 * fontSizeBase);
      const h5FontSizePt = fontSizeBase;
      const h6FontSizePt = Math.round(0.8 * fontSizeBase);

      const paddingRatio = 0.4;
      const h1PaddingBottomPx = ptToPx(h1FontSizePt * paddingRatio);
      const h2PaddingBottomPx = ptToPx(h2FontSizePt * paddingRatio);
      const h3PaddingBottomPx = ptToPx(h3FontSizePt * paddingRatio);
      const h4PaddingBottomPx = ptToPx(h4FontSizePt * paddingRatio);
      const h5PaddingBottomPx = ptToPx(h5FontSizePt * paddingRatio);
      const h6PaddingBottomPx = ptToPx(h6FontSizePt * paddingRatio);

      return `
  QLabel[cssClass~="h1"],
  QLabel[cssClass~="h2"],
  QLabel[cssClass~="h3"],
  QLabel[cssClass~="h4"],
  QLabel[cssClass~="h5"],
  QLabel[cssClass~="h6"] {
    font-weight: bold;
    color: ${headingsColor};
    padding: 0px;
    margin: 0px;
  }

  QLabel[cssClass~="h1"] {
    font-size: ${h1FontSizePt}pt;
    padding-bottom: ${h1PaddingBottomPx}px;
  }
  QLabel[cssClass~="h2"] {
    font-size: ${h2FontSizePt}pt;
    padding-bottom: ${h2PaddingBottomPx}px;
  }
  QLabel[cssClass~="h3"] {
    font-size: ${h3FontSizePt}pt;
    padding-bottom: ${h3PaddingBottomPx}px;
  }
  QLabel[cssClass~="h4"] {
    font-size: ${h4FontSizePt}pt;
    padding-bottom: ${h4PaddingBottomPx}px;
  }
  QLabel[cssClass~="h5"] {
    font-size: ${h5FontSizePt}pt;
    padding-bottom: ${h5PaddingBottomPx}px;
  }
  QLabel[cssClass~="h6"] {
    font-size: ${h6FontSizePt}pt;
    padding-bottom: ${h6PaddingBottomPx}px;
  }

  QLabel[cssClass~="group-left"], QLabel[cssClass~="group-right"] {
    color: ${textColor};
    background-color: ${groupTextBgColor};
    padding: ${inputPaddingVertical} ${inputPaddingHorizontal};
    border: ${inputBorderWidth} solid ${inputBorderColor};
  }

  QLabel[cssClass~="group-left"] {
    border-right-width: 0px;
    border-top-left-radius: ${borderRadius};
    border-bottom-left-radius: ${borderRadius};
  }

  QLabel[cssClass~="group-right"] {
    border-left-width: 0px;
    border-top-right-radius: ${borderRadius};
    border-bottom-right-radius: ${borderRadius};
  }

  QLabel[cssClass~="minor"] {
    color: ${textMinorColor};
  }

  QLabel[cssClass~="keycap"] {
    font-size: ${fontSizeSmall}pt;

    color: #333333;
    border: 1px solid #cccccc;
    border-bottom: 2px solid #cccccc;
    border-radius: 4px;

    background-color: #f7f7f7;
    padding: 0 5px 0 5px;
  }

  QLabel[cssClass~="table-header"] {
    border: 2px solid ${tableBorderColor};
    border-top: 0px;
    border-left: 0px;
    border-right: 0px;

    padding-top: ${tableCellPaddingVertical};
    padding-bottom: ${tableCellPaddingVertical};
  }

  QLabel[cssClass~="table-item"], QWidget[cssClass~="table-item"] {
    border: 1px solid ${tableBorderColor};
    border-top: 0px;
    border-left: 0px;
    border-right: 0px;

    padding-top: ${tableCellPaddingVertical};
    padding-bottom: ${tableCellPaddingVertical};
  }

  QLabel[cssClass~="badge"] {
    padding: ${badgeVerticalPadding} ${badgeHorizontalPadding} ${badgeVerticalPadding} ${badgeHorizontalPadding};
    font-size: ${badgeFontSize};
    font-weight: ${badgeFontWeight};
    color: ${badgeColor};

    background-color: ${badgeBackgroundColor};
    border-radius: ${badgeBorderRadius};
  }

  QLabel[cssClass~="h2-line"] {
    margin-bottom: ${h2PaddingBottomPx}px;
  }
  `;
    }

    function QLineEditQSpinBoxStyleSheet(resourceDirectory: string): string {
      return `
  QLineEdit, QSpinBox {
    color: ${textColor};
    background-color: ${inputBackgroundColor};
    padding: ${inputPaddingVertical} ${inputPaddingHorizontal};
    border: ${inputBorderWidth} solid ${inputBorderColor};
    border-radius: ${borderRadius};
  }

  QLineEdit[cssClass~="warning"], QSpinBox[cssClass~="warning"] {
    border: ${inputBorderWidth} solid ${brandWarning};
  }
  QLineEdit[cssClass~="warning"]:focus, QSpinBox[cssClass~="warning"]:focus {
    border: ${inputBorderWidth} solid ${brandWarning};
  }

  QLineEdit:hover, QSpinBox:hover {
    color: ${textHighlightColor};
  }

  QLineEdit:focus, QSpinBox:focus {
    color: ${textHighlightColor};
    background-color: ${inputActiveBgColor};

    outline: none;
    border-color: ${accentColor};
  }

  QLineEdit[cssClass~="group-left"], QSpinBox[cssClass~="group-left"] {
    border-top-right-radius: 0px;
    border-bottom-right-radius: 0px;
  }

  QLineEdit[cssClass~="group-middle"], QSpinBox[cssClass~="group-middle"] {
    border-radius: 0px;
  }

  QLineEdit[cssClass~="group-right"], QSpinBox[cssClass~="group-right"] {
    border-top-left-radius: 0px;
    border-bottom-left-radius: 0px;
  }

  QSpinBox::up-button {
    image: url(${resourceDirectory}/spin_up_arrow.svg);
  }

  QSpinBox::up-button:hover {
    image: url(${resourceDirectory}/spin_up_arrow_hover.svg);
  }

  QSpinBox::down-button {
    image: url(${resourceDirectory}/spin_down_arrow.svg);
  }

  QSpinBox::down-button:hover {
    image: url(${resourceDirectory}/spin_down_arrow_hover.svg);
  }
  `;
    }

    function QPushButtonStyleSheet(): string {
      return `
  QPushButton {
    font-weight: ${buttonFontWeight};
    font-size: ${buttonFontSize}pt;

    padding: 0.6em 0.6em;
    min-height: 1.4em;
    border-radius: ${borderRadius};
    border: ${btnBorder};
  }

  ${AtomButtonBG("QPushButton",
    buttonDefaultBgColor,
    buttonDefaultBgHoverColor,
    buttonDefaultBgSelectedColor,
    textColor)}

  ${AtomButtonVariant('QPushButton[cssClass~="plain"]', buttonDefaultBgColor)}
  ${AtomButtonVariant('QPushButton[cssClass~="primary"]', buttonPrimaryBgColor)}
  ${AtomButtonVariant('QPushButton[cssClass~="success"]', buttonSuccessBgColor)}
  ${AtomButtonVariant('QPushButton[cssClass~="info"]', buttonInfoBgColor)}
  ${AtomButtonVariant('QPushButton[cssClass~="warning"]', buttonWarningBgColor)}
  ${AtomButtonVariant('QPushButton[cssClass~="danger"]', buttonDangerBgColor)}

  QPushButton[cssClass~="small"] {
    font-size: ${buttonFontSizeSmall}pt;
    padding: 0.3em 0.5em;
  }

  QPushButton[cssClass~="group-left"] {
  border-top-right-radius: 0px;
  border-bottom-right-radius: 0px;
  }

  QPushButton[cssClass~="group-middle"] {
    border-radius: 0px;
    border-left-width: 0px;
  }

  QPushButton[cssClass~="group-right"] {
    border-top-left-radius: 0px;
    border-bottom-left-radius: 0px;
    border-left-width: 0px;
  }

  QPushButton:on {
    color: ${textSelectedColor};
    background-color: ${buttonDefaultBgSelectedColor};
  }

  QPushButton[cssClass~="microtool"] {
    background-color: transparent;

    width: 1.5em;
    height: 1.5em;

    padding: 0px;
    margin: 0px;
    border: 0px;
  }

  QPushButton[cssClass~="window-control"] {
    background-color: transparent;

    width: 1.5em;
    height: 1.5em;

    padding: 0px;
    margin: 0px;
    border: 0px;
    border-radius: 0px;
  }
  `;
    }

    function AtomButtonBG(baseRule: string, color: string, hoverColor: string, selectedColor: string, textColor: string): string {
      return `

  ${baseRule} {
    color: ${textColor};
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 ${toHex(lighten(color, 2))}, stop: 1 ${toHex(color)});
  }

  ${baseRule}:focus {
    border-color: ${toHex(accentColor)};
    outline: none;
  }

  ${baseRule}:hover {
    color: ${textHighlightColor};
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 ${toHex(lighten(hoverColor, 2))}, stop: 1 ${toHex(hoverColor)});
  }

  ${baseRule}:pressed {
    background-color: ${toHex(darken(color, 4))};
  }

  ${baseRule}[cssClass~="selected"] {
    color: ${textSelectedColor};
    background-color: ${selectedColor};
  }

  ${baseRule}[cssClass~="selected"]:focus, ${baseRule}[cssClass~="selected"]:hover {
    background-color: ${toHex(lighten(selectedColor, 2))};
  }

  ${baseRule}:disabled {
    color: ${mix(textHighlightColor, backgroundColor, 65)};
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 ${toHex(mix(lighten(color, 2), backgroundColor, 65))}, stop: 1 ${toHex(mix(color, backgroundColor, 65))});
  }

  ${baseRule}:hover:disabled {
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 ${toHex(mix(lighten(color, 2), backgroundColor, 65))}, stop: 1 ${toHex(mix(color, backgroundColor, 65))});
  }
  `;
    }

    function AtomButtonVariant(baseRule: string, color: string): string {
      const _textColor = contrast(color, "#ffffff", hsl(0, 0, 0.2));

      return AtomButtonBG(baseRule,
        color,
        lighten(color, 3),
        saturate(darken(color, 12), 20),
        textHighlightColor) +
  `
  ${baseRule} {
    color: ${_textColor};
    border: ${btnBorder};
  }
  ${baseRule}:hover, ${baseRule}:focus {
    color: ${_textColor};
  }

  `;
    }

    function QMenuStyleSheet(): string {
      return `
  QMenu {
    background-color: ${dropdownBgColor};
    border: 1px solid ${dropdownBorder};
    border-radius: ${borderRadius};
    padding-top: ${borderRadius};
    padding-bottom: ${borderRadius};
  }

  QMenu::item {
    font-size: ${inputFontSize};
    font-weight: normal;
    color: ${textColor};
    background-color: ${dropdownBgColor};
    padding: 1px 0px 0px 1.25em;
  }

  QMenu::icon {
    padding-left: 2.5em;
  }

  QMenu::item:selected {
    color: ${dropdownLinkHoverColor};
    background-color: ${dropdownLinkHoverBg};
  }

  QMenu::separator {
    height: 1px;
    color: ${textColor};
    background-color: ${textColor};
    margin-top: 0.3em;
    margin-bottom: 0.3em;
  }
  `;
    }

    function QRadioButtonStyleSheet(resourceDirectory: string): string {
      return `
  QRadioButton::indicator {
    width: 1em;
    height: 1em;
    border-radius: 0.49em;
    background-color: ${componentBackgroundColor};
  }

  QRadioButton::indicator:checked {
    background-color: ${brandInfo};
    image: url(${resourceDirectory}/radio_checked.svg);
  }
  `;
    }

    function QScrollAreaStyleSheet(): string {
      return `
  QScrollArea {
    ${IncludeDefaultBackground()}
  }
  `;
    }

    function QScrollBarStyleSheet(): string {
      return `
  QScrollBar {
    ${IncludeDefaultBackground()}
    background-image: none;
  }

  QScrollBar::add-page, QScrollBar::sub-page {
    background-image: none;
  }

  QScrollBar:vertical {
    ${IncludeDefaultBackground()}
    width: 0.5em;
  }
  QScrollBar::handle {
    border-radius: 0.2em;
    background-color: #4b5362;
  }
  QScrollBar::handle:hover {
    background-color: #868fa2;
  }

  QScrollBar::add-line, QScrollBar::sub-line {
    width: 0px;
    margin: 0px;
    padding: 0px;
    height: 0px;
    ${IncludeDefaultBackground()}
  }
  `;
    }

    function QTabBarStyleSheet(resourceDirectory: string): string {
      return TopLevelQTabBarStyleSheet(resourceDirectory) +
        SubLevelQTabBarStyleSheet(resourceDirectory);
    }

    function TopLevelQTabBarStyleSheet(resourceDirectory: string): string {
      return `
  QTabBar[cssClass~="top-level"]::tab {
    height: 1.6em;
    margin: 0px;

    padding-top: 0px;
    padding-bottom: 1px;
    padding-left: 0.666em;
    padding-right: 0.666em;

    border-radius: 0px;

    color: ${toHex(tabTextColor)};
    background-color: ${toHex(tabBackgroundColor)};

    border-top: 1px solid ${tabBorderColor};
    border-left: 1px solid ${tabBorderColor};
    border-bottom: 1px solid ${tabBorderColor};
  }

  QTabBar[cssClass~="top-level"]::tab:last, QTabBar[cssClass~="top-level"]::tab:only-one {
    border-right: 1px solid ${tabBorderColor};
  }

  QTabBar[cssClass~="top-level"] {
    qproperty-drawBase: 0;

    background-color: ${tabBackgroundColor};
    border-top: 0px;
    border-bottom: 1px solid ${tabBorderColor};
    margin: 0px;
  }

  QTabBar[cssClass~="top-level"]::tab:selected {
    color: ${tabTextColorActive};
    background-color: ${tabBackgroundColorActive};

    border-left: 2px solid ${accentColor};
    border-bottom: 1px solid ${tabBackgroundColorActive};
  }

  QTabBar[cssClass~="top-level"]::close-button {
    background-color: transparent;
    border: 0px;

    image: url(${resourceDirectory}/close_normal.svg);
  }

  QTabBar[cssClass~="top-level"]::close-button:hover {
    border-radius: ${borderRadius};
    background-color: ${buttonPrimaryBgColor};
    image: url(${resourceDirectory}/close_hover.svg);
  }

  `;
    }

    function SubLevelQTabBarStyleSheet(resourceDirectory: string): string {
      return `
  QTabBar[cssClass~="sub-level"]::tab {
    margin: 0px;
    padding: 0px;
    border: none;

    color: ${toHex(tabTextColor)};
    background-color: transparent;
    text-align: left;
    alignment: left;
  }

  QTabBar[cssClass~="sub-level"] {
    qproperty-drawBase: 0;

    background-color: transparent;
    border: none;
    margin: 0px;
  }

  QTabBar[cssClass~="sub-level"]::tab:selected {
    color: ${tabTextColorActive};
    text-decoration: underline;
  }
  `;
    }

    function QToolButtonStyleSheet(): string {
      return `
  QToolButton {
    border: 1px solid #00000000;
    border-radius: ${borderRadius};

    color: ${textColor};
    padding: 0px 0px 1px 2px;
  }

  QToolButton:hover {
    color: ${textHighlightColor};
    background-color: ${buttonDefaultBgHoverColor};
  }

  QToolButton::menu-arrow {
    image: none;
    width: 0px;
    height: 0px;
    padding: 0px 0px 0px 0px;
    margin: 0px 0px 0px 0px;
  }

  QToolButton::menu-indicator {
    image: none;
    width: 0px;
    height: 0px;
    padding: 0px 0px 0px 0px;
    margin: 0px 0px 0px 0px;
  }

  QToolButton::menu-button {
    width: 0px;
    height: 0px;
    padding: 0px 0px 0px 0px;
    margin: 0px 0px 0px 0px;
  }
  `;
    }

    function QWidgetStyleSheet(): string {
      return `
  QWidget[cssClass~="background"] {
    ${IncludeDefaultBackground()}
  }

  QWidget[cssClass~="window-background"] {
    background-color: ${level3Color};
  }
  `;

    }

    function LinkLabelCSS(): string {
      return `<style>
    A {
      color: ${linkColor};
      text-decoration: none;
    }

    span.hover A {
      color: ${linkHoverColor};
      text-decoration: ${linkHoverDecoration};
    }
    </style>`;
    }
    StyleLinkLabelCSS = LinkLabelCSS;

    function HTMLCSS(): string {
      return `<style>
    h1, h2, h3, h4, h5, h6 {
      font-weight: bold;
      color: ${headingsColor};
      line-height: 200%;
    }
    h1 {
      font-size: ${Math.round(2 * fontSizeBase)}pt;
    }
    h2 {
      font-size: ${Math.round(1.75 * fontSizeBase)}pt;
    }
    h3 {
      font-size: ${Math.round(1.4 * fontSizeBase)}pt;
    }
    h4 {
      font-size: ${Math.round(1.1 * fontSizeBase)}pt;
    }
    h5 {
      font-size: ${fontSizeBase}pt;
    }
    h6 {
      font-size: ${Math.round(0.8 * fontSizeBase)}pt;
    }

    table {
      border-collapse: collapse;
    }

    th {
      align: left;
      text-align: left;
      padding: 8px;

      vertical-align: bottom;
      border-bottom: 2px solid ${tableBorderColor};
    }

    td {
      align: left;
      text-align: left;
      padding: 8px;
    }
    </style>`;
    }
    StyleHTMLCSS = HTMLCSS;

    function ApplicationSpecificStyleSheet(): string {
      return `
  QWidget[cssClass~="tabbar-gap"] {
    border-top: 0px;
    border-bottom: 1px solid ${tabBorderColor};
    margin: 0px;
  }

  /* --- Settings page --- */

  QListWidget[cssClass~="settings-menu"] {
    show-decoration-selected: 1;
    padding-top: ${componentPaddingVertical};
    background-color: ${backgroundColor};

    border: none;
  }

  QListWidget[cssClass~="settings-menu"]::item {
    padding: ${navLinkPadding};
    border-left: ${navLinkPaddingLeft} solid transparent;  /* Hack, see 'navLinkPaddingLeft' def.*/
  }

  QListWidget[cssClass~="settings-menu"]::item:selected, QListWidget[cssClass~="settings-menu"]::item:hover {
    color: ${textSelectedColor};
    background-color: ${settingsBgSelectedColor};
  }

  QListWidget[cssClass~="settings-menu"]::item:focus {
    outline: none;
  }

  QStackedWidget[cssClass~="settings-stack"] {
    border-left: 1px solid ${baseBorderColor};
    border-top: none;
    border-right: none;
    border-bottom: none;
  }

  QScrollArea[cssClass~="settings-tab"] {
    border: none;
  }

  QWidget[cssClass~="settings-tab"] {
    ${IncludeDefaultBackground()}
    border: none;
  }

  QWidget[cssClass~="list-picker"] {
    ${IncludeDefaultBackground()}
    border: 1px solid ${overlayBorderColor};
    border-radius: ${borderRadius};
    border-top-left-radius: 0px;
    border-top-right-radius: 0px;
  }


  QTableView[cssClass~="list-picker"] {
    border: none;

    ${IncludeDefaultBackground()}
    color: ${textColor};

    selection-color: ${dropdownLinkHoverColor};
    selection-background-color: ${dropdownLinkHoverBg};
  }

  QFrame[cssClass~="card"] {
    padding: ${componentPaddingVerticalCard} ${componentPaddingHorizontalCard} ${componentPaddingVerticalCard} ${componentPaddingHorizontalCard};
    margin: 0px;
    border-radius: ${borderRadius2x};
    border: 1px solid ${baseBorderColor};
    background-color: ${packageCardBackgroundColor};
  }



  QPushButton[cssClass~="subtabbar-tab"] {
    color: ${textColor};

    font-size: ${Math.round(1.4 * fontSizeBase)}pt;
    font-weight: bold;
    padding: 0px;
    padding-bottom: 0.4em;

    text-align: left;
    background-color: transparent;
    border: none;
    border-radius: 0px;
  }

  QPushButton[cssClass~="subtabbar-tab"]:hover {
    text-decoration: underline;
  }

  QPushButton[cssClass~="subtabbar-tab"][cssClass~="selected"] {
    color: ${headingsColor};
    background-color: transparent;
    text-decoration: underline;
  }

  ${DecoratedFrameStyleSheet()}
  `;
    }

    function DecoratedFrameStyleSheet(): string {
      const borderWidth = "1px";

      return `
  QWidget[cssClass~="frame"] {
  }

  QWidget[cssClass~="decorated-frame"] {
    border-radius: ${borderRadius};
  }

  QWidget[cssClass~="decorated-frame"][cssClass~="posture-neutral"] {
    border: ${borderWidth} solid ${baseBorderColor};
  }
  QWidget[cssClass~="decorated-frame"][cssClass~="posture-failure"] {
    border: ${borderWidth} solid ${brandDanger};
  }
  QWidget[cssClass~="decorated-frame"][cssClass~="posture-running"] {
    border: ${borderWidth} solid ${baseBorderColor};
  }
  QWidget[cssClass~="decorated-frame"][cssClass~="posture-success"] {
    border: ${borderWidth} solid ${brandPrimary};
  }

  QWidget[cssClass~="decorated-frame-header"] {
    border-radius: ${borderRadius};
    background-color: ${level1Color};
  }
  QWidget[cssClass~="decorated-frame-header"][cssClass~="posture-neutral"] {
    border: ${borderWidth} solid ${baseBorderColor};
  }
  QWidget[cssClass~="decorated-frame-header"][cssClass~="posture-failure"] {
    border: ${borderWidth} solid ${brandDanger};
    border-bottom: 0px solid transparent;
    border-bottom-left-radius: 0px;
    border-bottom-right-radius: 0px;
  }
  QWidget[cssClass~="decorated-frame-header"][cssClass~="posture-running"] {
    border: ${borderWidth} solid ${baseBorderColor};
  }
  QWidget[cssClass~="decorated-frame-header"][cssClass~="posture-success"] {
    border: ${borderWidth} solid ${brandPrimary};
    border-bottom: 0px solid transparent;
    border-bottom-left-radius: 0px;
    border-bottom-right-radius: 0px;
  }

  QWidget[cssClass~="decorated-frame-header"] > QLabel[cssClass~="icon"] {
    padding-left: 2px;
  }

  QWidget[cssClass~="decorated-frame-header"][cssClass~="posture-success"] > QLabel[cssClass~="icon"] {
    color: ${brandPrimary};
  }

  QWidget[cssClass~="decorated-frame-header"][cssClass~="posture-failure"] > QLabel[cssClass~="icon"] {
    color: ${brandDanger};
  }
  QWidget[cssClass~="decorated-frame-header"][cssClass~="posture-failure"] > QLabel[cssClass~="command-line"] {
    color: ${brandDanger};
  }

  QWidget[cssClass~="decorated-frame-header"] > QPushButton[cssClass~="small"] {
    border: 0px transparent;
    border-radius: 0px;
    padding: 0px;
    margin-top: 1px;
    margin-right: 2px;
    height: 1em;
  }

  QWidget[cssClass~="decorated-frame-header"] > QPushButton[cssClass~="small"]:hover {
    background-color: transparent;
  }
  `;
    }

    return BodyStyleSheet() +
      QWidgetStyleSheet() +
      QCheckBoxStyleSheet(resourceDirectory) +
      QComboBoxStyleSheet(resourceDirectory) +
      QLabelStyleSheet() +
      QLineEditQSpinBoxStyleSheet(resourceDirectory) +
      QMenuStyleSheet() +
      QPushButtonStyleSheet() +
      QRadioButtonStyleSheet(resourceDirectory) +
      QScrollAreaStyleSheet() +
      QScrollBarStyleSheet() +
      QTabBarStyleSheet(resourceDirectory) +
      QToolButtonStyleSheet() +
      ApplicationSpecificStyleSheet() +
      "";
  }

  return {
    getApplicationStyleSheet(guiScale: number, dpi: number): string {
      return DarkTwoStyleSheet(resourceDirectory, guiScale, dpi);
    },
    getMenuIcon(name: string): QIcon {
      const normalColor = toRgba(styleTextColor);
      const hoverColor = toRgba(styleDropdownLinkHoverColor);

      return createIcon(name, {
        normalOnRgba: normalColor,
        selectedOnRgba: hoverColor,
        activeOnRgba: hoverColor,

        normalOffRgba: normalColor,
        selectedOffRgba: hoverColor,
        activeOffRgba: hoverColor,
      });
    },
    getSettingsMenuIcon(name: string): QIcon {
      const normalColor = toRgba(styleTextColor);
      const hoverColor = toRgba(styleDropdownLinkHoverColor);

      return createIcon(name, {
        normalOnRgba: normalColor,
        selectedOnRgba: hoverColor,
        activeOnRgba: hoverColor,

        normalOffRgba: normalColor,
        selectedOffRgba: hoverColor,
        activeOffRgba: hoverColor,

        scale: 0.7,
      });
    },
    getTabIcon(name: string): QIcon {
      return this.getMenuIcon(name);
    },
    getCommandPaletteIcon(name: string): QIcon {
      return this.getMenuIcon(name);
    },
    getButtonIcon(name: string): QIcon {
      return this.getMenuIcon(name);
    },
    getToolbarButtonIconPair(name: string): IconPair {
      const normalColor = toRgba(styleTextColor);
      const normalIcon = createIcon(name, {
        normalOnRgba: normalColor,
        selectedOnRgba: normalColor,
        activeOnRgba: normalColor,

        normalOffRgba: normalColor,
        selectedOffRgba: normalColor,
        activeOffRgba: normalColor,
      });

      const hoverColor = toRgba(styleTextHighlightColor);
      const hoverIcon = createIcon(name, {
        normalOnRgba: hoverColor,
        selectedOnRgba: hoverColor,
        activeOnRgba: hoverColor,

        normalOffRgba: hoverColor,
        selectedOffRgba: hoverColor,
        activeOffRgba: hoverColor,
      });

      return { normal: normalIcon, hover: hoverIcon };
    },
    getBorderlessButtonIconPair(name: string): IconPair {
      const normalColor = toRgba(styleTextColor);
      const normalIcon = createIcon(name, {
        normalOnRgba: normalColor,
        selectedOnRgba: normalColor,
        activeOnRgba: normalColor,

        normalOffRgba: normalColor,
        selectedOffRgba: normalColor,
        activeOffRgba: normalColor,
      });

      const hoverColor = toRgba(styleBackgroundColor);
      const hoverIcon = createIcon(name, {
        normalOnRgba: hoverColor,
        selectedOnRgba: hoverColor,
        activeOnRgba: hoverColor,

        normalOffRgba: hoverColor,
        selectedOffRgba: hoverColor,
        activeOffRgba: hoverColor,
      });

      return { normal: normalIcon, hover: hoverIcon };
    },
    getLinkLabelCSS(): string {
      return StyleLinkLabelCSS();
    },
    getHTMLStyle(): string {
      return StyleHTMLCSS();
    },
    getTrafficLightRunningColor(): string {
      return toHex(styleBrandSuccess);
    },
    getTrafficLightStoppedColor(): string {
      return toHex(styleBrandDanger);
    },
    getFrameMarginLeftRightPx(): number {
      return 4;
    },
    getDecoratedFrameMarginTopPx(): number {
      return 0;
    },
    getDecoratedFrameMarginBottomPx(): number {
      return 4;
    }
  };
}

function contrast(baseColor, color1, color2) {
  const brightBase = lightness(baseColor);
  const bright1 = lightness(color1);
  const bright2 = lightness(color2);
  if(Math.abs(brightBase - bright1) > Math.abs(brightBase - bright2)) {
    return color1;
  } else {
    return color2;
  }
}
