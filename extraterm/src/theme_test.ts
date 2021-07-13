import { Direction, QApplication, QMainWindow, QWidget } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, Label, PushButton, Widget } from "qt-construct";
import * as fs from "fs";

let centralWidget: QWidget = null;

function main(): void {
  const win = new QMainWindow();
  win.setWindowTitle("Theme Test");
  centralWidget = new QWidget();
  centralWidget.setLayout(
    BoxLayout({
      direction: Direction.TopToBottom,
      children: [
        PushButton({text: "Reload Styles", onClicked: loadStyle}),
        Label({text: "Hello"}),
        CheckBox({text: "I like checkboxes"}),

        ComboBox({items: ["Pizza", "Chips"]}),
        { widget: Widget({}), stretch: 1}
      ]
    })
  );

  loadStyle();
  win.setCentralWidget(centralWidget);
  win.show();

  (global as any).win = win;
}

function loadStyle(): void {
  const styleSheet = fs.readFileSync("/home/sbe/devel/extraterm_qt/extraterm/src/dark_two.css", {encoding: "utf8"});
  centralWidget.setStyleSheet(styleSheet);
}

main();

const darkTwo = `
/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
/* just the font-face tag for color Emoji */
@font-face {
  font-family: "coloremoji";
  src: url("/opt/extraterm/resources/app/extraterm/resources/themes/default/fonts/Twemoji.ttf?v=1.0.0") format("truetype");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+00a9, U+00ae, U+203c, U+2049, U+2122, U+2139, U+2194-2199, U+21a9-21aa, U+231a-231b, U+2328, U+23cf, U+23e9-23f3, U+23f8-23fa, U+24c2, U+25aa-25ab, U+25b6, U+25c0, U+25fb-25fe, U+2600-2604, U+260e, U+2611, U+2614-2615, U+2618, U+261d, U+2620, U+2622-2623, U+2626, U+262a, U+262e-262f, U+2638-263a, U+2640, U+2642, U+2648-2653, U+265f-2660, U+2663, U+2665-2666, U+2668, U+267b, U+267e-267f, U+2692-2697, U+2699, U+269b-269c, U+26a0-26a1, U+26a7, U+26aa-26ab, U+26b0-26b1, U+26bd-26be, U+26c4-26c5, U+26c8, U+26ce-26cf, U+26d1, U+26d3-26d4, U+26e9-26ea, U+26f0-26f5, U+26f7-26fa, U+26fd, U+2702, U+2705, U+2708-270d, U+270f, U+2712, U+2714, U+2716, U+271d, U+2721, U+2728, U+2733-2734, U+2744, U+2747, U+274c, U+274e, U+2753-2755, U+2757, U+2763-2764, U+2795-2797, U+27a1, U+27b0, U+27bf, U+2934-2935, U+2b05-2b07, U+2b1b-2b1c, U+2b50, U+2b55, U+3030, U+303d, U+3297, U+3299, U+e50a, U+1f000-1ffff;
}
html, body {
  font-family: "coloremoji", "BlinkMacSystemFont", "Lucida Grande", "Segoe UI", Ubuntu, Cantarell, sans-serif;
  font-size: 1rem;
}

body {
  line-height: 1.428571429;
  color: #9da5b4;
}

a {
  color: #6494ed;
  cursor: pointer;
}
a:hover {
  color: #1f64e5;
  text-decoration: underline;
}

h1, h2, h3, h4, h5, h6 {
  font-family: "coloremoji", "BlinkMacSystemFont", "Lucida Grande", "Segoe UI", Ubuntu, Cantarell, sans-serif;
  font-weight: bold;
  line-height: 1.1;
  color: #ffffff;
}

h1 {
  font-size: 2rem;
}

h2 {
  font-size: 1.75rem;
}

h3 {
  font-size: 1.4rem;
}

h4 {
  font-size: 1.1rem;
}

h5 {
  font-size: 1rem;
}

h6 {
  font-size: 0.8rem;
}

hr {
  border: 0;
  border-top: 1px solid #181a1f;
}

p.minor, span.minor {
  color: #667085;
}

.highlight-success, .highlight-info, .highlight-warning, .highlight-error, .highlight-danger {
  color: #d7dae0;
  font-weight: bold;
  border-radius: 2px;
  padding: 1px 3px;
}

.highlight-success {
  background-color: rgba(115, 201, 144, 0.5);
}

.highlight-info {
  background-color: rgba(100, 148, 237, 0.5);
}

.highlight-warning {
  background-color: rgba(226, 192, 141, 0.5);
}

.highlight-danger {
  background-color: rgba(255, 99, 71, 0.5);
}

.no-user-select {
  user-select: none;
}

button {
  font-weight: normal;
  font-family: "coloremoji", "BlinkMacSystemFont", "Lucida Grande", "Segoe UI", Ubuntu, Cantarell, sans-serif;
  user-select: none;
  box-sizing: border-box;
  font-size: 1rem;
  line-height: 1.428571429;
  padding: 0.8rem 0.8rem;
  height: calc(1.428571429rem + 1.6rem + 2px);
  text-align: center;
  vertical-align: middle;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid #181a1f;
  white-space: nowrap;
  color: #9da5b4;
  background-color: transparent;
  background-image: linear-gradient(#3a404b, #353b45);
}
button:hover {
  color: #d7dae0;
  background-image: linear-gradient(#3e4451, #3a404b);
}
button:active {
  background: #2c313a;
  box-shadow: none;
}
button.selected {
  color: #fff;
  background: #456fc4;
}
button.selected:focus, button.selected:hover {
  background: #4d75c6;
}
button:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
button.small {
  box-sizing: border-box;
  font-size: 0.9rem;
  line-height: 1.428571429;
  padding: 0.4rem 0.5rem;
  height: calc(1.2857142861rem + 0.8rem + 2px);
}
button.inline {
  display: inline-block;
  box-sizing: border-box;
  font-size: 0.9rem;
  line-height: 1.428571429;
  vertical-align: baseline;
  height: unset;
  padding: 0.25rem 0.5rem;
}
button.inline:after {
  content: " ";
  font-size: 1.2rem;
}
button.inline.toolbar {
  min-width: calc(2 * 0.5rem + 1.5em);
}
button.primary {
  color: #d7dae0;
  background-color: transparent;
  background-image: linear-gradient(#4d75c6, #456fc4);
  color: white;
  border-color: 1px solid #181a1f;
}
button.primary:hover {
  color: #d7dae0;
  background-image: linear-gradient(#587eca, #5178c8);
}
button.primary:active {
  background: #3b65ba;
  box-shadow: none;
}
button.primary.selected {
  color: #fff;
  background: #1d4daf;
}
button.primary.selected:focus, button.primary.selected:hover {
  background: #1e51b8;
}
button.primary:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
button.primary:hover, button.primary:focus {
  color: white;
}
button.primary:focus {
  border-color: transparent;
  background-clip: padding-box;
  box-shadow: inset 0 0 0 1px rgba(24, 26, 31, 0.5), 0 0 0 1px #456fc4;
}
button.success {
  color: #d7dae0;
  background-color: transparent;
  background-image: linear-gradient(#2da946, #2ba143);
  color: white;
  border-color: 1px solid #181a1f;
}
button.success:hover {
  color: #d7dae0;
  background-image: linear-gradient(#30b54b, #2ead47);
}
button.success:active {
  background: #27913c;
  box-shadow: none;
}
button.success.selected {
  color: #fff;
  background: #107f26;
}
button.success.selected:focus, button.success.selected:hover {
  background: #118829;
}
button.success:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
button.success:hover, button.success:focus {
  color: white;
}
button.success:focus {
  border-color: transparent;
  background-clip: padding-box;
  box-shadow: inset 0 0 0 1px rgba(24, 26, 31, 0.5), 0 0 0 1px #2ba143;
}
button.info {
  color: #d7dae0;
  background-color: transparent;
  background-image: linear-gradient(#0f87f0, #0f82e6);
  color: white;
  border-color: 1px solid #181a1f;
}
button.info:hover {
  color: #d7dae0;
  background-image: linear-gradient(#1e8ef1, #1489f0);
}
button.info:active {
  background: #0d77d3;
  box-shadow: none;
}
button.info.selected {
  color: #fff;
  background: #0062b8;
}
button.info.selected:focus, button.info.selected:hover {
  background: #0067c2;
}
button.info:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
button.info:hover, button.info:focus {
  color: white;
}
button.info:focus {
  border-color: transparent;
  background-clip: padding-box;
  box-shadow: inset 0 0 0 1px rgba(24, 26, 31, 0.5), 0 0 0 1px #0f82e6;
}
button.warning {
  color: #d7dae0;
  background-color: transparent;
  background-image: linear-gradient(#b6830c, #ad7c0b);
  color: white;
  border-color: 1px solid #181a1f;
}
button.warning:hover {
  color: #d7dae0;
  background-image: linear-gradient(#c58d0d, #bb860c);
}
button.warning:active {
  background: #996e0a;
  box-shadow: none;
}
button.warning.selected {
  color: #fff;
  background: #7a5600;
}
button.warning.selected:focus, button.warning.selected:hover {
  background: #855d00;
}
button.warning:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
button.warning:hover, button.warning:focus {
  color: white;
}
button.warning:focus {
  border-color: transparent;
  background-clip: padding-box;
  box-shadow: inset 0 0 0 1px rgba(24, 26, 31, 0.5), 0 0 0 1px #ad7c0b;
}
button.danger {
  color: #d7dae0;
  background-color: transparent;
  background-image: linear-gradient(#d34336, #d13c2e);
  color: white;
  border-color: 1px solid #181a1f;
}
button.danger:hover {
  color: #d7dae0;
  background-image: linear-gradient(#d64f43, #d4473a);
}
button.danger:active {
  background: #c0372a;
  box-shadow: none;
}
button.danger.selected {
  color: #fff;
  background: #b21d10;
}
button.danger.selected:focus, button.danger.selected:hover {
  background: #bc1f10;
}
button.danger:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
button.danger:hover, button.danger:focus {
  color: white;
}
button.danger:focus {
  border-color: transparent;
  background-clip: padding-box;
  box-shadow: inset 0 0 0 1px rgba(24, 26, 31, 0.5), 0 0 0 1px #d13c2e;
}
button[disabled] {
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
}
button.quiet.quiet.quiet {
  border-color: transparent;
  color: #9da5b4;
  text-shadow: none;
  transition: color, border-color 0.2s ease-in-out;
  background-image: none;
}
button.quiet.quiet.quiet:hover, button.quiet.quiet.quiet:focus {
  border-color: #181a1f;
  color: #9da5b4;
  background-color: transparent;
  background-image: linear-gradient(#3a404b, #353b45);
}
button.quiet.quiet.quiet:hover:hover, button.quiet.quiet.quiet:focus:hover {
  color: #d7dae0;
  background-image: linear-gradient(#3e4451, #3a404b);
}
button.quiet.quiet.quiet:hover:active, button.quiet.quiet.quiet:focus:active {
  background: #2c313a;
  box-shadow: none;
}
button.quiet.quiet.quiet:hover.selected, button.quiet.quiet.quiet:focus.selected {
  color: #fff;
  background: #456fc4;
}
button.quiet.quiet.quiet:hover.selected:focus, button.quiet.quiet.quiet:hover.selected:hover, button.quiet.quiet.quiet:focus.selected:focus, button.quiet.quiet.quiet:focus.selected:hover {
  background: #4d75c6;
}
button.quiet.quiet.quiet:hover:focus, button.quiet.quiet.quiet:focus:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
button.microtool {
  font-weight: normal;
  border-color: transparent;
  color: #9da5b4;
  text-shadow: none;
  transition: color, background-color 0.2s ease-in-out;
  background-image: none;
  box-shadow: none;
  border-radius: 4px;
  width: 1.5em;
  height: 1.5em;
  text-align: center;
  padding: 0;
  vertical-align: middle;
  position: relative;
}
button.microtool > I {
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
button.microtool:focus {
  outline: 0;
  box-shadow: none;
}
button.microtool:hover, button.microtool:focus {
  box-shadow: none;
  background-color: #353b45;
  color: #282c34;
}
button.microtool.primary:hover, button.microtool.primary:focus {
  background-color: #456fc4;
}
button.microtool.success:hover, button.microtool.success:focus {
  background-color: #2ba143;
}
button.microtool.info:hover, button.microtool.info:focus {
  background-color: #0f82e6;
}
button.microtool.warning:hover, button.microtool.warning:focus {
  background-color: #ad7c0b;
}
button.microtool.danger:hover, button.microtool.danger:focus {
  background-color: #d13c2e;
}

div.group, span.group {
  user-select: none;
}
div.group > button:not(:first-child), span.group > button:not(:first-child) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
div.group > button:not(:last-child), span.group > button:not(:last-child) {
  border-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

input:not([type=radio]), select {
  font-size: 1.2rem;
  font-family: "coloremoji", "BlinkMacSystemFont", "Lucida Grande", "Segoe UI", Ubuntu, Cantarell, sans-serif;
  color: #9da5b4;
  padding: 0.25rem 0.5rem;
  line-height: 1.428571429;
  border: 1px solid #181a1f;
  border-radius: 4px;
  transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s;
}
input:not([type=radio]):disabled, select:disabled {
  cursor: not-allowed;
}
input:not([type=radio]):hover, select:hover {
  color: #d7dae0;
}

input:not([type=radio]):not([type=checkbox]), select {
  box-shadow: inset 0 0.0833333333rem 0.0833333333rem rgba(0, 0, 0, 0.075);
}

select {
  background-color: #353b45;
  color: #9da5b4;
}
select:hover {
  color: #d7dae0;
  background-color: #3a404b;
}
select:focus {
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}

input:not([type=radio]) {
  color: #9da5b4;
  background-color: #1b1d23;
}
input:not([type=radio]):focus {
  color: #d7dae0;
  background-color: #1f2533;
  outline: none;
  border-color: #578af2;
  box-shadow: 0 0 0 1px #578af2;
}
input:not([type=radio]).has-success {
  border-color: #73c990;
}
input:not([type=radio]).has-warning {
  border-color: #e2c08d;
}
input:not([type=radio]).has-error {
  border-color: tomato;
}

input[type=checkbox] {
  -webkit-appearance: none;
  display: inline-block;
  position: relative;
  font-size: 1.2rem;
  margin: 0 0.25rem 0 0;
  vertical-align: -0.3rem;
  width: 1.5rem;
  height: 1.5rem;
  cursor: pointer;
  outline: 0;
  border-radius: 4px;
  background-color: rgba(157, 165, 180, 0.6);
  transition: background-color 0.16s cubic-bezier(0.5, 0.15, 0.2, 1);
}
input[type=checkbox]:focus {
  background-color: rgba(157, 165, 180, 0.6);
}
input[type=checkbox]:disabled {
  background-color: #353b45;
}
input[type=checkbox]:active {
  background-color: #6494ed;
}
input[type=checkbox]::before, input[type=checkbox]::after {
  content: "";
  position: absolute;
  top: 1.1rem;
  left: 0.55rem;
  height: 0.16rem;
  min-height: 0.1666666667rem;
  border-radius: 0.0833333333rem;
  background-color: #282c34;
  transform-origin: 0% 0%;
  opacity: 0;
  transition: transform 0.1s cubic-bezier(0.5, 0.15, 0.2, 1), opacity 0.1s cubic-bezier(0.5, 0.15, 0.2, 1);
}
input[type=checkbox]::before {
  width: 0.45rem;
  transform: rotate(225deg) scale(0);
}
input[type=checkbox]::after {
  width: 0.9rem;
  margin: -1px;
  transform: rotate(-45deg) scale(0);
  transition-delay: 0.05s;
}
input[type=checkbox]:checked {
  background-color: #6494ed;
}
input[type=checkbox]:checked:active {
  background-color: rgba(157, 165, 180, 0.6);
}
input[type=checkbox]:checked:disabled {
  background-color: #353b45;
}
input[type=checkbox]:checked::before, input[type=checkbox]:checked::after {
  opacity: 1;
}
input[type=checkbox]:checked::before {
  transform: rotate(225deg) scale(1);
  transition-delay: 0.05s;
}
input[type=checkbox]:checked::after {
  transform: rotate(-45deg) scale(1);
  transition-delay: 0;
}

input[type=radio] {
  -webkit-appearance: none;
  display: inline-block;
  position: relative;
  outline: none;
  vertical-align: middle;
  margin: 0 0.25rem 0 0;
  padding: 0;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 1.2rem;
  vertical-align: -0.3rem;
  border-radius: 50%;
  background-color: rgba(157, 165, 180, 0.6);
  transition: background-color 0.16s cubic-bezier(0.5, 0.15, 0.2, 1);
}
input[type=radio]:before {
  content: "";
  position: absolute;
  box-sizing: border-box;
  padding: 0;
  top: 0;
  left: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: inherit;
  border: 0.5rem solid transparent;
  background-clip: content-box;
  background-color: #282c34;
  transform: scale(0);
  transition: transform 0.1s cubic-bezier(0.5, 0.15, 0.2, 1);
}
input[type=radio]:active {
  background-color: #6494ed;
}
input[type=radio]:checked {
  background-color: #6494ed;
}
input[type=radio]:checked:before {
  transform: scale(1);
}

input[type=range] {
  -webkit-appearance: none;
  margin: 10px 0;
  height: 4px;
  border-radius: 3px;
  background-color: rgba(157, 165, 180, 0.6);
  box-sizing: border-box;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #456fc4;
  transition: transform 0.16s;
}
input[type=range]::-webkit-slider-thumb:active {
  transition-duration: 0s;
  transform: scale(0.9);
}

label {
  margin-right: 0.5rem;
  font-size: 1.2rem;
  user-select: none;
}

.gui-layout > label {
  justify-content: stretch;
  text-align: right;
}

.gui-packed-row > label {
  margin-right: 0;
}

span.group {
  display: inline-block;
  font-size: 1.2rem;
}
span.group > span {
  display: inline-block;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  background-color: #353b45;
  line-height: 1.428571429;
  border-top: 1px solid #181a1f;
  border-bottom: 1px solid #181a1f;
  border-radius: 0;
}
span.group > span:after {
  content: " ";
  font-size: 1.2rem;
}
span.group > span:first-child {
  border-left-width: 1px;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}
span.group > input:not(:first-child) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
span.group > span:last-child {
  border-right: 1px solid #181a1f;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
span.group > input:not(:last-child) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.char-width-2 {
  width: 2em;
  min-width: 2em;
  max-width: 2em;
}

select.char-width-2 {
  width: 3em;
  min-width: 3em;
  max-width: 3em;
}

input[type=number].char-width-2 {
  width: 5ch;
  min-width: 5ch;
  max-width: 5ch;
}

.char-width-3 {
  width: 3em;
  min-width: 3em;
  max-width: 3em;
}

select.char-width-3 {
  width: 4em;
  min-width: 4em;
  max-width: 4em;
}

input[type=number].char-width-3 {
  width: 6ch;
  min-width: 6ch;
  max-width: 6ch;
}

.char-width-4 {
  width: 4em;
  min-width: 4em;
  max-width: 4em;
}

select.char-width-4 {
  width: 5em;
  min-width: 5em;
  max-width: 5em;
}

input[type=number].char-width-4 {
  width: 7ch;
  min-width: 7ch;
  max-width: 7ch;
}

.char-width-6 {
  width: 6em;
  min-width: 6em;
  max-width: 6em;
}

select.char-width-6 {
  width: 7em;
  min-width: 7em;
  max-width: 7em;
}

input[type=number].char-width-6 {
  width: 9ch;
  min-width: 9ch;
  max-width: 9ch;
}

.char-width-8 {
  width: 8em;
  min-width: 8em;
  max-width: 8em;
}

select.char-width-8 {
  width: 9em;
  min-width: 9em;
  max-width: 9em;
}

input[type=number].char-width-8 {
  width: 11ch;
  min-width: 11ch;
  max-width: 11ch;
}

.char-width-12 {
  width: 12em;
  min-width: 12em;
  max-width: 12em;
}

select.char-width-12 {
  width: 13em;
  min-width: 13em;
  max-width: 13em;
}

input[type=number].char-width-12 {
  width: 15ch;
  min-width: 15ch;
  max-width: 15ch;
}

.char-width-20 {
  width: 20em;
  min-width: 20em;
  max-width: 20em;
}

select.char-width-20 {
  width: 21em;
  min-width: 21em;
  max-width: 21em;
}

input[type=number].char-width-20 {
  width: 23ch;
  min-width: 23ch;
  max-width: 23ch;
}

.char-width-30 {
  width: 30em;
  min-width: 30em;
  max-width: 30em;
}

select.char-width-30 {
  width: 31em;
  min-width: 31em;
  max-width: 31em;
}

input[type=number].char-width-30 {
  width: 33ch;
  min-width: 33ch;
  max-width: 33ch;
}

.char-width-40 {
  width: 40em;
  min-width: 40em;
  max-width: 40em;
}

select.char-width-40 {
  width: 41em;
  min-width: 41em;
  max-width: 41em;
}

input[type=number].char-width-40 {
  width: 43ch;
  min-width: 43ch;
  max-width: 43ch;
}

.char-width-60 {
  width: 60em;
  min-width: 60em;
  max-width: 60em;
}

select.char-width-60 {
  width: 61em;
  min-width: 61em;
  max-width: 61em;
}

input[type=number].char-width-60 {
  width: 63ch;
  min-width: 63ch;
  max-width: 63ch;
}

.char-width-80 {
  width: 80em;
  min-width: 80em;
  max-width: 80em;
}

select.char-width-80 {
  width: 81em;
  min-width: 81em;
  max-width: 81em;
}

input[type=number].char-width-80 {
  width: 83ch;
  min-width: 83ch;
  max-width: 83ch;
}

.char-max-width-2 {
  min-width: 0;
  max-width: 2em;
}

select.char-max-width-2 {
  min-width: 0;
  max-width: 3em;
}

input[type=number].char-max-width-2 {
  min-width: 0;
  max-width: 5ch;
}

.char-max-width-3 {
  min-width: 0;
  max-width: 3em;
}

select.char-max-width-3 {
  min-width: 0;
  max-width: 4em;
}

input[type=number].char-max-width-3 {
  min-width: 0;
  max-width: 6ch;
}

.char-max-width-4 {
  min-width: 0;
  max-width: 4em;
}

select.char-max-width-4 {
  min-width: 0;
  max-width: 5em;
}

input[type=number].char-max-width-4 {
  min-width: 0;
  max-width: 7ch;
}

.char-max-width-6 {
  min-width: 0;
  max-width: 6em;
}

select.char-max-width-6 {
  min-width: 0;
  max-width: 7em;
}

input[type=number].char-max-width-6 {
  min-width: 0;
  max-width: 9ch;
}

.char-max-width-8 {
  min-width: 0;
  max-width: 8em;
}

select.char-max-width-8 {
  min-width: 0;
  max-width: 9em;
}

input[type=number].char-max-width-8 {
  min-width: 0;
  max-width: 11ch;
}

.char-max-width-12 {
  min-width: 0;
  max-width: 12em;
}

select.char-max-width-12 {
  min-width: 0;
  max-width: 13em;
}

input[type=number].char-max-width-12 {
  min-width: 0;
  max-width: 15ch;
}

.char-max-width-20 {
  min-width: 0;
  max-width: 20em;
}

select.char-max-width-20 {
  min-width: 0;
  max-width: 21em;
}

input[type=number].char-max-width-20 {
  min-width: 0;
  max-width: 23ch;
}

.char-max-width-30 {
  min-width: 0;
  max-width: 30em;
}

select.char-max-width-30 {
  min-width: 0;
  max-width: 31em;
}

input[type=number].char-max-width-30 {
  min-width: 0;
  max-width: 33ch;
}

.char-max-width-40 {
  min-width: 0;
  max-width: 40em;
}

select.char-max-width-40 {
  min-width: 0;
  max-width: 41em;
}

input[type=number].char-max-width-40 {
  min-width: 0;
  max-width: 43ch;
}

.char-max-width-60 {
  min-width: 0;
  max-width: 60em;
}

select.char-max-width-60 {
  min-width: 0;
  max-width: 61em;
}

input[type=number].char-max-width-60 {
  min-width: 0;
  max-width: 63ch;
}

.char-max-width-80 {
  min-width: 0;
  max-width: 80em;
}

select.char-max-width-80 {
  min-width: 0;
  max-width: 81em;
}

input[type=number].char-max-width-80 {
  min-width: 0;
  max-width: 83ch;
}

progress {
  height: 8px;
  -webkit-appearance: none;
  border-radius: 4px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px #181a1f;
  -webkit-animation: animate-stripes 5s linear 6;
  background-image: linear-gradient(-45deg, transparent 33%, rgba(87, 138, 242, 0.2) 33%, rgba(87, 138, 242, 0.2) 66%, transparent 66%);
  background-size: 25px 8px, 100% 100%, 100% 100%;
}

progress::-webkit-progress-bar {
  background-color: transparent;
}

progress::-webkit-progress-value {
  border-radius: 4px;
  background-image: none;
  background-color: #578af2;
}

progress[value] {
  background-image: none;
  -webkit-animation: none;
}

@-webkit-keyframes animate-stripes {
  100% {
    background-position: 100px 0px;
  }
}
.width-100pc {
  width: 100%;
}

.width-800px {
  width: 800px;
}

.max-width-800px {
  max-width: 800px;
}

.gui-layout {
  display: grid;
  grid-auto-flow: row;
  align-items: baseline;
  grid-gap: 0.5rem 0;
  margin-bottom: 0.5rem;
}
.gui-layout.cols-1 {
  grid-template-columns: 1fr;
}
.gui-layout.cols-1-1 {
  grid-template-columns: 1fr 1fr;
}
.gui-layout.cols-1-2 {
  grid-template-columns: 1fr 2fr;
}
.gui-layout.cols-1-3 {
  grid-template-columns: 1fr 3fr;
}
.gui-layout .full-width {
  grid-column: auto/span 2;
}

.gui-packed-row {
  display: flex;
  align-items: baseline;
  margin-bottom: 0.5rem;
}
.gui-packed-row > .gui-packed-row, .gui-packed-row > .gui-layout {
  margin-bottom: 0px;
}
.gui-packed-row > * {
  margin-left: 0.5rem;
}
.gui-packed-row > *:first-child {
  margin-left: 0;
}
.gui-packed-row > .expand {
  flex-grow: 1;
}
.gui-packed-row > .compact {
  flex-grow: 0;
  flex-shrink: 0;
}

.gui-layout > .gui-packed-row {
  margin-bottom: 0px;
}

table {
  background-color: transparent;
  border-collapse: collapse;
  border-spacing: 0;
}
table.cols-1-1 > thead > tr > th {
  width: 50%;
}

th, td {
  text-align: left;
  padding: 0.6666666667rem;
  line-height: 1.428571429;
  vertical-align: baseline;
  border-top: 1px solid #181a1f;
}

thead > tr > th {
  vertical-align: bottom;
  border-bottom: 2px solid #181a1f;
}

thead:first-child > tr:first-child > th, thead:first-child > tr:first-child > td {
  border-top: 0;
}

table.table-hover > tbody > tr:hover {
  background-color: rgba(255, 255, 255, 0.07);
}

.badge {
  display: inline-block;
  min-width: 1em;
  padding: 0.2em 0.5em;
  font-size: 0.6em;
  font-weight: bold;
  color: #d7dae0;
  line-height: 1;
  vertical-align: 0.3333333333em;
  white-space: nowrap;
  text-align: center;
  background-color: rgba(255, 255, 255, 0.07);
  border-radius: 1.5em;
}
.badge.success {
  background-color: #73c990;
}
.badge.info {
  background-color: #6494ed;
}
.badge.warning {
  background-color: #e2c08d;
}
.badge.danger {
  background-color: tomato;
}

/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
::-webkit-scrollbar {
  width: 0.8333333333rem;
  height: 0.8333333333rem;
}

::-webkit-scrollbar-track {
  background-color: var(--scrollbar-track-background-color);
}

::-webkit-scrollbar-thumb {
  border-radius: 0.4166666667rem;
  border: 3px solid #21252b;
  background-color: var(--scrollbar-thumb-background-color);
}
::-webkit-scrollbar-thumb:active {
  border-radius: 0px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-thumb-hover-background-color);
}

.keycap {
  display: inline-block;
  font-family: "coloremoji", "BlinkMacSystemFont", "Lucida Grande", "Segoe UI", Ubuntu, Cantarell, sans-serif;
  color: #333333;
  border: 1px solid #cccccc;
  border-bottom: 2px solid #cccccc;
  border-radius: 0.3333333333rem;
  padding: 0 2px;
  background-color: #ffffff;
}
.keycap > SPAN {
  font-size: 80%;
  background-color: #f7f7f7;
  padding: 0 0.4166666667rem;
}


.sr-only {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}

.sr-only-focusable:active, .sr-only-focusable:focus {
  clip: auto;
  height: auto;
  margin: 0;
  overflow: visible;
  position: static;
  width: auto;
}

/* Note: The font-face directives have been moved out into fontawesome-fontface.scss */
.fab {
  font-family: "Font Awesome 5 Brands";
  font-weight: 400;
}

.far {
  font-family: "Font Awesome 5 Free";
  font-weight: 400;
}

.fa,
.fas {
  font-family: "Font Awesome 5 Free";
  font-weight: 900;
}
@charset "UTF-8";
.extraicon {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  display: inline-block;
  font-style: normal;
  font-variant: normal;
  text-rendering: auto;
  line-height: 1;
  font-family: "extraicons";
  text-align: center;
  width: 1.25em;
}

.extraicon-pocketknife:before {
  content: "";
}
@charset "UTF-8";
/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
/* top UI */
/**
 * Copyright 2016-2018 Simon Edwards <simon@simonzone.com>
 */
/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
/* just the font-face tag for extraicons */
@font-face {
  font-family: "extraicons";
  src: url("/opt/extraterm/resources/app/extraterm/resources/themes/default/fonts/extraicons.ttf?v=1.0.0") format("truetype");
  font-weight: normal;
  font-style: normal;
}
#ID_MINIMIZE_BUTTON, #ID_MAXIMIZE_BUTTON, #ID_CLOSE_BUTTON {
  flex-grow: 0;
  flex-shrink: 0;
  position: relative;
  width: 1.75rem;
  height: 1.75rem;
  color: #9da5b4;
  background-color: transparent;
  border: 0;
  border-radius: 0;
  vertical-align: baseline;
  background-image: none;
  box-shadow: none;
  transition: color, background-color 0.2s ease-in-out;
}
#ID_MINIMIZE_BUTTON:hover, #ID_MAXIMIZE_BUTTON:hover, #ID_CLOSE_BUTTON:hover {
  color: #d7dae0;
}
#ID_MINIMIZE_BUTTON:focus, #ID_MAXIMIZE_BUTTON:focus, #ID_CLOSE_BUTTON:focus {
  outline: 0rem solid transparent;
}
#ID_MINIMIZE_BUTTON:before, #ID_MAXIMIZE_BUTTON:before, #ID_CLOSE_BUTTON:before {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

#ID_MINIMIZE_BUTTON, #ID_MAXIMIZE_BUTTON {
  font-size: 1rem;
}
#ID_MINIMIZE_BUTTON:hover, #ID_MAXIMIZE_BUTTON:hover {
  background-color: #353b45;
}

#ID_CLOSE_BUTTON:hover {
  background-color: tomato;
}

#ID_MINIMIZE_BUTTON:before {
  font-size: 1rem;
  font-family: extraicons;
  content: "";
}

#ID_MAXIMIZE_BUTTON:before {
  font-size: 1rem;
  font-family: extraicons;
  content: "";
}

#ID_CLOSE_BUTTON:before {
  font-family: "Font Awesome 5 Free";
  font-weight: 900;
  font-size: 1.2rem;
  content: "";
}

/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
/* just the font-face tag for extraicons */
@font-face {
  font-family: "extraicons";
  src: url("/opt/extraterm/resources/app/extraterm/resources/themes/default/fonts/extraicons.ttf?v=1.0.0") format("truetype");
  font-weight: normal;
  font-style: normal;
}
#ID_TITLE_BAR {
  flex-grow: 0;
  display: flex;
  width: 100%;
}

#ID_TITLE_BAR_SPACE {
  flex-grow: 1;
  position: relative;
}

#ID_TOP_RESIZE_BAR {
  position: absolute;
  top: 0rem;
  bottom: 0px;
  width: 100%;
}

#ID_DRAG_BAR {
  position: absolute;
  top: 0px;
  width: 100%;
  -webkit-app-region: drag;
  cursor: move;
  height: 0.333333rem;
}

#ID_REST_DIV_LEFT {
  display: none;
}

:host {
  display: block;
  position: relative;
}

:host(:focus) {
  outline: 0 solid transparent;
}

#ID_TOP_LAYOUT {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

#ID_MAIN_CONTENTS {
  position: relative;
}
#ID_MAIN_CONTENTS > * {
  position: absolute;
  width: 100%;
  height: 100%;
}

#ID_TITLE_BAR {
  position: absolute;
  left: 0;
  top: 0;
  width: 1rem;
  height: 2.6rem;
}

:host.CLASS_ENABLE_WINDOW_MOVE #ID_TITLE_BAR {
  -webkit-app-region: drag;
  background-color: red;
}

#ID_MAIN_CONTENTS {
  position: absolute;
  width: 100%;
  height: 100%;
}

.CLASS_NEW_BUTTON_CONTAINER {
  display: flex;
  flex-grow: 1;
  height: 100%;
}
.CLASS_NEW_BUTTON_CONTAINER > button {
  flex-grow: 0;
}
.CLASS_NEW_BUTTON_CONTAINER > #ID_NEW_TERMINAL_CONTEXT_AREA {
  align-self: center;
}
.CLASS_NEW_BUTTON_CONTAINER > #ID_NEW_TERMINAL_CONTEXT_AREA > .CLASS_NEW_TAB_BUTTON:focus, .CLASS_NEW_BUTTON_CONTAINER > #ID_NEW_TERMINAL_CONTEXT_AREA > .CLASS_NEW_TAB_BUTTON:active {
  box-shadow: none;
}

/* Contents of the tabs at the top of the window. */
DIV.tab_content {
  height: 100%;
  width: 100%;
  position: relative;
}

DIV.tab_content > * {
  position: absolute;
  width: 100%;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

ET-TAB:focus {
  outline: none;
}

DIV.tab_header_container {
  display: flex;
  width: 100%;
  z-index: 1;
  font-size: 1rem;
}

DIV.tab_header_icon {
  flex: 1 1 auto;
  font-size: 125%;
  text-align: right;
  margin-left: 0.8333333333rem;
}

DIV.tab_header_middle {
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 0.6666666667rem;
  margin-right: 0.6666666667rem;
}

DIV.tab_header_tag {
  flex: 1 1 auto;
}

DIV.tab_title_extensions {
  display: flex;
  flex: 1 1 auto;
  overflow: hidden;
  margin-left: 0.6666666667rem;
  margin-right: 0.6666666667rem;
}
DIV.tab_title_extensions > et-extension-widget-proxy {
  width: 100%;
}

DIV.tab_header_close {
  flex: 0 0 auto;
  align-self: center;
  min-width: 2.6rem;
  text-align: center;
}

DIV.tab_header_container > DIV.tab_header_close > BUTTON > I {
  transform: translate(-50%, -50%) scale(0, 0);
  transition: transform 0.08s;
}

DIV.tab_header_container:hover > DIV.tab_header_close > BUTTON > I {
  transform: translate(-50%, -50%) scale(1, 1);
  transition-duration: 0.16s;
}

.CLASS_NEW_TAB_BUTTON {
  margin-left: 0.55rem;
}

DIV.tab_header_close > BUTTON.microtool.danger {
  background-image: none;
}
DIV.tab_header_close > BUTTON.microtool.danger:hover {
  color: #21252b;
  background-color: #578af2;
}
DIV.tab_header_close > BUTTON.microtool.danger:focus {
  color: #21252b;
  box-shadow: none;
  background-color: rgba(87, 138, 242, 0.5);
  outline: 0 solid transparent;
}
DIV.tab_header_close > BUTTON.microtool.danger:active {
  color: #21252b;
  background-color: rgba(87, 138, 242, 0.5);
}
`