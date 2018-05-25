import { TerminalEditSession } from "../TerminalEditSession";
import { EditSession } from "ace-ts/build/EditSession";
import { Editor } from "ace-ts/build/Editor";
import { UndoManager } from "ace-ts/build/UndoManager";
import { Renderer } from "ace-ts/build/Renderer";
import * as dom from "ace-ts/build/lib/dom";
import * as event from "ace-ts/build/lib/event";
import { TerminalAceEditor } from "../TerminalAceEditor";
import * as TermApi from "term-api";


function createEditSession(text, mode?): EditSession {
  var doc = new EditSession(text, mode);
  doc.setUndoManager(new UndoManager());
  return doc;
};

function terminalEditor(elementOrString: HTMLElement | string): TerminalAceEditor {
  let el: Element = null;
  let value = "";
  if (typeof elementOrString == "string") {
      const _id = elementOrString;
      el = document.getElementById(_id);
      if (!el)
          throw new Error("ace.edit can't find div #" + _id);
  } else {

      if (elementOrString && /input|textarea/i.test(elementOrString.tagName)) {
          var oldNode = elementOrString as HTMLInputElement | HTMLTextAreaElement;
          value = oldNode.value;
          el = dom.createElement("pre") as HTMLPreElement;
          oldNode.parentNode.replaceChild(el, oldNode);
      }
  }
  if (el) {
      value = el.textContent;
      el.innerHTML = "";
  }

  var editSession = new TerminalEditSession(value);
  editSession.setUndoManager(new UndoManager());

  var editor = new TerminalAceEditor(new Renderer(el as HTMLElement), editSession);
  editor.addCommand({
      name: "pasteSomething",
      bindKey: {win: "Ctrl-V", mac: "Command-V"},
      exec: function (editor: Editor) {
          editor.insert("abc\ndef\nghi");
      }
  });

  var env = {
      document: editSession,
      editor: editor,
      onResize: editor.resize.bind(editor, null),
      textarea: null
  };
  if (oldNode) env.textarea = oldNode;
  event.addListener(window, "resize", env.onResize);
  editor.on("destroy", function() {
      event.removeListener(window, "resize", env.onResize);
  });
  return editor;
}

function getLine(): TermApi.Line {
  const input = <HTMLInputElement> document.getElementById("input_line");
  const text = input.value;

  // const attrLineInput = <HTMLInputElement> document.getElementById("attr_line");
  // if (attrLineInput.value != "") {
  //   attr = parseInt(attrLineInput.value);
  // }

  let cellStyle = 0;
  if ((<HTMLInputElement> document.getElementById("bold")).checked) {
    cellStyle = cellStyle | TermApi.BOLD_ATTR_FLAG;
  }
  if ((<HTMLInputElement> document.getElementById("italic")).checked) {
    cellStyle = cellStyle | TermApi.ITALIC_ATTR_FLAG;
  }
  if ((<HTMLInputElement> document.getElementById("underline")).checked) {
    cellStyle = cellStyle | TermApi.UNDERLINE_ATTR_FLAG;
  }

  let attr = TermApi.packAttr(cellStyle, 267, 256);

  // export const BLINK_ATTR_FLAG = 4;
  // export const INVERSE_ATTR_FLAG = 8;
  // export const INVISIBLE_ATTR_FLAG = 16;
  // export const STRIKE_THROUGH_ATTR_FLAG = 64;
  // export const FAINT_ATTR_FLAG = 128;

  const codePoints = new Uint32Array(text.length);
  for (let i=0; i<text.length; i++) {
    codePoints[i] = text.codePointAt(i);
  }

  const attrs = new Uint32Array(text.length);
  for (let i=0; i<text.length; i++) {
    attrs[i] = attr;
  }

  const line: TermApi.Line = {
    chars: codePoints,
    attrs
  };
  return line;
}

function start(): void {
  console.log("Starting test");
  const editor = terminalEditor("editor");
  editor.setThemeCss("ace-terminal-theme", "terminal.css");

  document.getElementById("append_text").addEventListener('click', () => {
    const line = getLine();
    editor.appendTerminalLine(line);
  });
  
  document.getElementById("replace_text").addEventListener('click', () => {
    const line = getLine();
    editor.setTerminalLine(0, line);
  });
}
start();
