/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, Logger, Style, TerminalEnvironment } from '@extraterm/extraterm-extension-api';
import { Direction, Key, QAction, QKeyEvent, QLineEdit, QPoint, QPushButton, QSizePolicyPolicy, QVariant, QWidget, TextFormat, WidgetAttribute,
  WindowType } from "@nodegui/nodegui";
import { BoxLayout, GridLayout, Label, LineEdit, Menu, PushButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";

import { Segment, TemplateString } from './TemplateString.js';
import { TitlePreview } from './TitlePreview.js';


export class TemplateEditor {

  #widget: QWidget;
  #style: Style;
  #templateString: TemplateString;
  #titlePreview: TitlePreview = null;

  #onAcceptEventEmitter = new EventEmitter<void>();
  onAccept: Event<void> = null;

  #onCancelEventEmitter = new EventEmitter<void>();
  onCancel: Event<void> = null;

  #onTemplateChangedEventEmitter = new EventEmitter<string>();
  onTemplateChanged: Event<string> = null;

  #templateLineEdit: QLineEdit = null;

  constructor(templateString: TemplateString, style: Style, log: Logger) {
    this.onAccept = this.#onAcceptEventEmitter.event;
    this.onCancel = this.#onCancelEventEmitter.event;
    this.onTemplateChanged = this.#onTemplateChangedEventEmitter.event;
    this.#templateString = templateString;
    this.#style = style;

    let iconButton: QPushButton = null;

    const fieldList = [
      ["Title", TerminalEnvironment.TERM_TITLE],
      ["Rows", TerminalEnvironment.TERM_ROWS],
      ["Columns", TerminalEnvironment.TERM_COLUMNS],
      ["Current command", TerminalEnvironment.EXTRATERM_CURRENT_COMMAND],
      ["Last command", TerminalEnvironment.EXTRATERM_LAST_COMMAND],
      ["Current command line", TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE],
      ["Last command line", TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE],
      ["Exit code", TerminalEnvironment.EXTRATERM_EXIT_CODE],
    ];
    const fieldMenu = Menu({
      onTriggered: (nativeAction) => {
        const action = new QAction(nativeAction);
        this.#insertText("${" + action.data().toString() + "}");
      }
    });
    for (const item of fieldList) {
      const action = fieldMenu.addAction(`${item[0]}   $\{${item[1]}\}`);
      action.setData(new QVariant(item[1]));
    }

    const iconPopup = this.#createIconPopup((iconName: string): void => {
      this.#insertText("${icon:" + iconName +"}");
      iconPopup.hide();
    });
    this.#titlePreview = new TitlePreview(this.#templateString, this.#style, log);
    this.#titlePreview.onSegmentClicked((segment: Segment): void => {
      this.#templateLineEdit.setSelection(segment.startColumn, segment.endColumn - segment.startColumn);
      this.#templateLineEdit.setFocus();
    });

    this.#widget = Widget({
      contentsMargins: 0,

      layout: GridLayout({
        columns: 2,
        contentsMargins: 0,
        children: [
          Label({
            textFormat: TextFormat.RichText,
            text: this.#style.createHtmlIcon("fa-pencil-alt")
          }),
          {
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: 0,
              children: [
                this.#templateLineEdit = LineEdit({
                  text: templateString.getTemplateString(),
                  onTextEdited: (newText: string) => {
                    this.#templateStringChanged();
                  },
                  onKeyPress: this.#onKeyPress.bind(this),

                }),
                {
                  layout: BoxLayout({
                    direction: Direction.LeftToRight,
                    contentsMargins: 0,
                    spacing: 0,
                    children: [
                      PushButton({
                        text: "Insert Field",
                        cssClass: ["group-left", "small"],
                        menu: fieldMenu
                      }),
                      iconButton = PushButton({
                        text: "Insert Icon",
                        cssClass: ["group-right", "small"],
                        onClicked: () => {
                          if (iconPopup.isVisible()) {
                            iconPopup.hide();
                            return;
                          }

                          const rect = iconButton.geometry();
                          const bottomLeft = this.#widget.mapToGlobal(new QPoint(rect.left(), rect.top() + rect.height()));
                          iconPopup.setGeometry(bottomLeft.x(), bottomLeft.y(), rect.width(), 200);
                          iconPopup.raise();
                          iconPopup.show();
                        }
                      })
                    ]
                  })
                }
              ]
            })
          },
          Widget({
            contentsMargins: 0
          }),
          this.#titlePreview.getWidget()
        ]
      })
    });
  }

  #onKeyPress(nativeEvent): void {
    const event = new QKeyEvent(nativeEvent);

    const key = event.key();
    if(key !== Key.Key_Escape && key !== Key.Key_Enter && key !== Key.Key_Return) {
      return;
    }

    event.accept();
    this.#templateLineEdit.setEventProcessed(true);

    if(key === Key.Key_Escape) {
      this.#onCancelEventEmitter.fire();
    } else {
      this.#onAcceptEventEmitter.fire();
    }
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  setTemplateText(text: string): void {
    this.#templateLineEdit.setText(text);
    this.#templateStringChanged();
  }

  focus(): void {
    this.#templateLineEdit.setFocus();
  }

  #insertText(text: string): void {
    this.#templateLineEdit.insert(text);
    this.#templateStringChanged();
  }

  #templateStringChanged(): void {
    const string = this.#templateLineEdit.text();
    this.#templateString.setTemplateString(string);
    this.#titlePreview.templateStringUpdated();
    this.#onTemplateChangedEventEmitter.fire(string);
  }

  #createIconPopup(iconSelectedFunc: (iconName: string) => void): QWidget {
    const ICONS_PER_ROW = 10;
    const iconList: string[] = [
      "fa-linux",
      "fa-windows",
      "fa-apple",
      "fa-android",
      "fa-ubuntu",
      "fa-fedora",
      "fa-redhat",
      "fa-suse",
      "fa-centos",
      "fa-freebsd",

      "fa-keyboard",
      "fa-terminal",
      "fa-docker",
      "fa-laptop",
      "fa-desktop",
      "fa-server",
      "fa-database",
      "fa-microchip",
      "fa-mobile-alt",
      "fa-tablet-alt",

      "fa-bug",
      "fa-code",
      "fa-git",
      "fa-code-branch",
      "fa-sitemap",
      "fa-cloud",
      "fa-upload",
      "fa-download",
      "fa-comments",
      "fa-envelope",

      "fa-home",
      "fa-building",
      "fa-industry",
      "fa-city",
      "fa-robot",
      "fa-raspberry-pi",
      "fa-bolt",
      "fa-exclamation-triangle",
      "fa-shield-alt",
      "fa-usb",
    ];

    const buttonStyleSheet = `
QPushButton[cssClass~="terminal-title"] {
  background-color: transparent;
  border: 0px;
  border-radius: 0px;
}
QPushButton[cssClass~="terminal-title"]:hover {
  background-color: ${this.#style.palette.backgroundSelected};
}
`;

    const iconPopup = Widget({
      cssClass: ["window-background"],
      windowFlag: WindowType.Popup,
      contentsMargins: 0,
      attribute: [WidgetAttribute.WA_WindowPropagation, WidgetAttribute.WA_X11NetWmWindowTypePopupMenu],
      sizePolicy: {
        vertical: QSizePolicyPolicy.Minimum,
        horizontal: QSizePolicyPolicy.Minimum,
      },
      layout: GridLayout({
        columns: ICONS_PER_ROW,
        spacing: 0,
        contentsMargins: [0, 0, 0, 0],
        children: iconList.map(iconName => {
          const icon = this.#style.createQIcon(<any> iconName);
          const hoverIcon = this.#style.createQIcon(<any> iconName, this.#style.palette.textHighlight);
          const pb = PushButton({
            cssClass: ["terminal-title"],
            toolTip: "${icon:" + iconName + "}",
            icon,
            sizePolicy: {
              vertical: QSizePolicyPolicy.Minimum,
              horizontal: QSizePolicyPolicy.Minimum,
            },
            onClicked: () => {
              iconSelectedFunc(iconName);
            },
            onEnter: () => {
              pb.setIcon(hoverIcon);
            },
            onLeave: () => {
              pb.setIcon(icon);
            }
          });
          pb.setStyleSheet(buttonStyleSheet);
          return pb;
        }),
      })
    });
    return iconPopup;
  }
}
