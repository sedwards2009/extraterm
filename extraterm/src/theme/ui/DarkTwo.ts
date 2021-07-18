/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { alpha, change, darken, fadeOut, hsl, lighten, lightness, mix, rgba, saturate, toHex } from "khroma";

const fontSizeBase = 9;
const fontSizeSmall = Math.round(fontSizeBase * 0.9);


const uiFg = "#9da5b4";
const accentBgColor = "hsl(219,  79%, 66%)";
const uiBg = "#282c34";
const uiBorder = "#181a1f";

const headingsColor = "#ffffff";
const accentColor = "#578af2";

// const level1Color = "#353b45";
const level1Color = lighten(uiBg, 6);


const level2Color = uiBg;
const level3Color = darken(uiBg, 3);


const textColor = uiFg;

const textColorSubtle = change(textColor, { a: alpha(textColor) - 0.4});
const textMinorColor = darken(textColor, 20);
const textHighlightColor = lighten(textColor, 20);
const textSelectedColor = "#ffffff";
const backgroundHighlightColor = rgba(255, 255, 255, 0.07);

// Background color for `<body>`.
const backgroundColor = uiBg;
const backgroundSelectedColor = accentBgColor;


// const textColorSubtle = "rgba(157, 165, 180, 0.6)";

const textMutedColor = mix(textColor, backgroundColor, 75);

const brandPrimary = "hsl(219,  79%, 66%)";
const brandSuccess = "hsl(140,  44%, 62%)";
const brandInfo = "hsl(219,  79%, 66%)";
const brandWarning = "hsl( 36,  60%, 72%)";
const brandDanger = "hsl(  9, 100%, 64%)";

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

const inputBackgroundColor = darken(backgroundColor, 6);
const inputBorderColor = baseBorderColor;
const inputPaddingVertical = "0.25em";
const inputPaddingHorizontal = "0.5em";
const inputBorderWidth = "1px";
const inputActiveBgColor = mix(accentBgColor, inputBackgroundColor, 10);

const btnBorder = `1px solid ${buttonDefaultBorderColor}`;

const groupTextBgColor = buttonDefaultBgColor;


export function DarkTwoStyleSheet(resourceDirectory: string): string {
  return BodyStyleSheet() +
    QCheckBoxStyleSheet(resourceDirectory) +
    QComboBoxStyleSheet() +
    QLabelStyleSheet() +
    QLineEditQSpinBoxStyleSheet() +
    QPushButtonStyleSheet() +
    QRadioButtonStyleSheet(resourceDirectory) +
    QScrollBarStyleSheet() +
    QTabBarStyleSheet() +
    "";
}

function BodyStyleSheet(): string {
  return `
* {
  color: ${textColor};
  background-color: #282c34;
  font-size: ${fontSizeBase}pt
}
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

function QComboBoxStyleSheet(): string {
  return `
QComboBox {
  background-color: #353b45;
  color: #9da5b4;

  padding: 0.25em 0.5em;

  border: 1px solid #181a1f;
  border-radius: ${borderRadius};

  selection-color: #d7dae0;
  selection-background-color: #578af2;
}

QComboBox:hover, QComboBox:on {
  color: #d7dae0;
  background-color: #3a404b;
}
QComboBox:focus {
  border-color: #578af2;
}

QComboBox::drop-down {
  subcontrol-origin: padding;
  subcontrol-position: top right;

  border-left-width: 0px;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  /* TODO: chevron svg */
}

QComboBox QAbstractItemView {
  selection-background-color: #578af2;
  background-color: #3a404b;
  color: #d7dae0;
  /* color: #ff00ff; */
}

QComboBox QAbstractItemView:hover {
color: #80ff80;
}

QComboBox QAbstractItemView:hover {
  color: #ffff00;
}
`;
}

function QLabelStyleSheet(): string {
  return `
QLabel[cssClass~="h1"],
QLabel[cssClass~="h2"],
QLabel[cssClass~="h3"],
QLabel[cssClass~="h4"],
QLabel[cssClass~="h5"],
QLabel[cssClass~="h6"] {
  font-weight: bold;
  color: ${headingsColor};
}

QLabel[cssClass~="h1"] {
  font-size: ${Math.round(2 * fontSizeBase)}pt;
}
QLabel[cssClass~="h2"] {
  font-size: ${Math.round(1.75 * fontSizeBase)}pt;
}
QLabel[cssClass~="h3"] {
  font-size: ${Math.round(1.4 * fontSizeBase)}pt;
}
QLabel[cssClass~="h4"] {
  font-size: ${Math.round(1.1 * fontSizeBase)}pt;
}
QLabel[cssClass~="h5"] {
  font-size: ${fontSizeBase}pt;
}
QLabel[cssClass~="h6"] {
  font-size: ${Math.round(0.8 * fontSizeBase)}pt;
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
`;
}

function QLineEditQSpinBoxStyleSheet(): string {
  return `
QLineEdit, QSpinBox {
  color: ${textColor};
  background-color: ${inputBackgroundColor};
  padding: ${inputPaddingVertical} ${inputPaddingHorizontal};
  border: ${inputBorderWidth} solid ${inputBorderColor};
  border-radius: ${borderRadius};
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

function QScrollBarStyleSheet(): string {
  return `
QScrollBar:vertical {
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
}
`;
}

function QTabBarStyleSheet(): string {
  return `
QTabBar::tab {
  height: 1.6em;
  margin: 0px;
  padding: 0px 0px 0px 1px;
  border-radius: 0px;

  color: rgba(157, 165, 180, 0.6);
  background-color: #21252b;

  border-top: 1px solid #181a1f;
  border-left: 1px solid #181a1f;
  border-right: 1px solid #181a1f;

}

QTabBar::tab:selected {
  color: #d7dae0;
  background-color: #282c34;

  border-left: 2px solid #578af2;
}
`;
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

