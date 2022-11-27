import { QApplication, Direction, QMainWindow, QStyleFactory, QWidget, QTextEdit, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, Label, LineEdit, ProgressBar, PushButton, RadioButton, ScrollArea, SpinBox,
  TabWidget, TextEdit, ToolButton, Widget } from "qt-construct";
import * as path from "node:path";
import * as SourceDir from './SourceDir.js';

import { createUiStyle } from "./ui/styles/DarkTwo.js";
import { shrinkWrap } from "./ui/QtConstructExtra.js";

let centralWidget: QWidget = null;

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

function main(): void {
  console.log(`Style keys`);
  for (const key of QStyleFactory.keys()) {
    console.log(`Style key: ${key}`);
  }
  QApplication.setStyle(QStyleFactory.create("Windows"));

  const win = new QMainWindow();
  win.setWindowTitle("Theme Test");

  const dpi = QApplication.primaryScreen().logicalDotsPerInch();
  const uiStyle = createUiStyle(path.posix.join(SourceDir.posixPath, "../resources/theme_ui/DarkTwo/"));

  let guiScale = 1;
  function applyStyleSheet(): void {
    const styleSheet = uiStyle.getApplicationStyleSheet(guiScale, dpi);
    console.log(styleSheet);
    stylesheetEdit.setText(styleSheet);
    topWidget.setStyleSheet(styleSheet, false);
  }
  uiStyle.getApplicationStyleSheet(guiScale, dpi);  // Force DarkTwo it init internally.

  let stylesheetEdit: QTextEdit = null;

  centralWidget = ScrollArea({
    widgetResizable: true,
    widget: Widget({
      cssClass: "background",
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: [
          Label({text: "H1 Heading", cssClass: "h1"}),
          Label({text: "H2 Heading", cssClass: "h2"}),
          Label({text: "H3 Heading", cssClass: "h3"}),
          Label({text: "H4 Heading", cssClass: "h4"}),
          Label({text: "H5 Heading", cssClass: "h5"}),
          Label({text: "H6 Heading", cssClass: "h6"}),
          Label({text: "Plain QLabel text"}),
          shrinkWrap(Label({cssClass: ["badge"], text: "Default Badge"})),

          PushButton({text: "Default button"}),
          PushButton({text: "Success button", cssClass: "success"}),
          PushButton({text: "Info button", cssClass: "info"}),
          PushButton({text: "Warning button", cssClass: "warning"}),
          PushButton({text: "Danger button", cssClass: "danger"}),

          PushButton({text: "Disabled default button", enabled: false}),
          PushButton({text: "Disabled success button", enabled: false, cssClass: "success"}),
          PushButton({text: "Disabled info button", enabled: false, cssClass: "info"}),
          PushButton({text: "Disabled warning button", enabled: false, cssClass: "warning"}),
          PushButton({text: "Disabled danger button", enabled: false, cssClass: "danger"}),

          PushButton({text: "Small Default button", cssClass: "small"}),
          PushButton({text: "Small Success button", cssClass: ["small", "success"]}),
          PushButton({text: "Small Info button", cssClass: ["small", "info"]}),
          PushButton({text: "Small Warning button", cssClass: ["small", "warning"]}),
          PushButton({text: "Small Danger button", cssClass: ["small", "danger"]}),

          ToolButton({text: "QToolButton Default"}),
          ToolButton({text: "QToolButton Success", cssClass: ["success"]}),
          ToolButton({text: "QToolButton Info", cssClass: ["info"]}),
          ToolButton({text: "QToolButton Warning", cssClass: ["warning"]}),
          ToolButton({text: "QToolButton Danger", cssClass: ["danger"]}),

          LineEdit({text: "Some text input"}),


          ComboBox({items: ["One", "Two"]}),

          CheckBox({text: "Checkbox"}),
          CheckBox({text: "Select Checkbox", checkState: true}),
          CheckBox({text: "Disabled Checkbox", enabled: false}),

          RadioButton({text: "Radio button"}),
          RadioButton({text: "Selected Radio button", checked: true}),

          SpinBox({suffix: " frames", minimum: 0, maximum: 1000}),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: PushButton({ text: "Left", cssClass: ["group-left"] }), stretch: 0 },
                { widget: PushButton({ text: "Right", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: PushButton({ text: "Left", cssClass: ["group-left"] }), stretch: 0 },
                { widget: PushButton({ text: "Middle", cssClass: ["group-middle"] }), stretch: 0 },
                { widget: PushButton({ text: "Right", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "I like", cssClass: ["group-left"] }), stretch: 0 },
                { widget: LineEdit({ text: "bananas", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "I like", cssClass: ["group-left"] }), stretch: 0 },
                { widget: LineEdit({ text: "bananas", cssClass: ["group-middle"] }), stretch: 0 },
                { widget: Label({ text: "for breakfast.", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "$", cssClass: ["group-left"] }), stretch: 0 },
                { widget: SpinBox({minimum: 0, maximum: 1000, cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "$", cssClass: ["group-left"] }), stretch: 0 },
                { widget: SpinBox({minimum: 0, maximum: 1000, cssClass: ["group-middle"] }), stretch: 0 },
                { widget: Label({ text: ".00", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: SpinBox({minimum: 0, maximum: 1000, cssClass: ["group-left"] }), stretch: 0 },
                { widget: Label({ text: "euro", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          SpinBox({suffix: " frames", minimum: 0, maximum: 1000}),

          ProgressBar({
            minimum: 0,
            maximum: 100,
            value: 0,
            textVisible: false,
          }),

          ProgressBar({
            minimum: 0,
            maximum: 100,
            value: 50,
            textVisible: false,
          }),

          ProgressBar({
            minimum: 0,
            maximum: 100,
            value: 100,
            textVisible: false,
          }),

          TabWidget({
            tabs: [
              {label: "Extraterm", page: Widget({})},
              {label: "Tabs", page: Widget({})},
            ]
          }),

          Label({
            text: `${uiStyle.getHTMLStyleTag()}
<h1>QLabel with Rich text</h1>
<H1>H1 Heading</H1>
<H2>H2 Heading</H2>
<H3>H3 Heading</H3>
<H4>H4 Heading</H4>
<H5>H5 Heading</H5>
<H6>H6 Heading</H6>
<p>QLabel normal text and a <a href="https://extraterm.org/">Link</a>.<p>
<p>Text with a <span class="keycap">keycap</span> inside.</p>
`,
            textFormat: TextFormat.RichText
          }),
          { widget: Widget({}), stretch: 1}
        ]
      })
    })
  });

  const topWidget = Widget({
    cssClass: "background",
    layout: BoxLayout({
      direction: Direction.LeftToRight,
      children: [
        centralWidget,

        BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            {
              widget: stylesheetEdit = TextEdit({
              plainText: "",
              }),
              stretch: 1
            },

            {
              layout: BoxLayout({
                direction: Direction.LeftToRight,
                children: [
                  PushButton({
                    text: "Apply Stylesheet",
                    onClicked: () => {
                      topWidget.setStyleSheet(stylesheetEdit.toPlainText(), false);
                    }
                  }),
                  {
                    widget: ComboBox({
                      items: uiScalePercentOptions.map(percent => percent.name),
                      currentIndex: 5,
                      onActivated: (index: number) => {
                        guiScale = uiScalePercentOptions[index].id / 100;
                        applyStyleSheet();
                      }
                    }),
                    stretch: 0
                  },
                ]
              }),
              stretch: 0
            }
          ]
        })
      ]
    })
  });

  applyStyleSheet();

  win.resize(1200, 800);
  win.setCentralWidget(topWidget);
  win.show();

  (global as any).win = win;
}

main();
