import { TerminalEditSession } from "../TerminalEditSession";
import { EditSession } from "ace-ts/build/EditSession";
import { Editor } from "ace-ts/build/Editor";
import { UndoManager } from "ace-ts/build/UndoManager";
import { Renderer } from "ace-ts/build/Renderer";
import * as dom from "ace-ts/build/lib/dom";
import * as event from "ace-ts/build/lib/event";


function createEditSession(text, mode?): EditSession {
  var doc = new EditSession(text, mode);
  doc.setUndoManager(new UndoManager());
  return doc;
};

function terminalEditor(elementOrString: HTMLElement | string): Editor {
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

  var editor = new Editor(new Renderer(el as HTMLElement), editSession);
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

function start(): void {
  console.log("Starting test");
  const editor = terminalEditor("editor");
  editor.setThemeCss("ace-terminal-theme", "terminal.css");
}
start();
