///<reference path='../chrome_lib.d.ts'/>
import menuitem = require("./menuitem");
import util = require("./util");

var ID = "CbContextMenuTemplate";

/**
 * A context menu.
 */
class CbContextMenu extends HTMLElement {
  
  private createClone() {
    var template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>\n" +
        ".container {\n" +
        "    position: fixed;\n" +
        "    background-color: #F4F4F4;\n" +
        "    border-radius: 4px;\n" +
        "    padding: 4px 0px 4px 0px;\n" +
        "    box-shadow: 0px 0px 8px black;\n" +
        "    z-index: 101;\n" +
        "}\n" +

        ".container_closed {\n" +
        "    display: none;\n" +
        "}\n" +

        ".container_open {\n" +
        "\n" +
        "}\n" +

        ".cover_closed {\n" +
        "    visibility: hidden;\n" +
        "}\n" +

        ".cover_open {\n" +
        "    visibility: visible;\n" +
        "    position: fixed;\n" +
        "    left: 0px;\n" +
        "    right: 0px;\n" +
        "    top: 0px;\n" +
        "    bottom: 0px;\n" +
        "    z-index: 100;\n" +
  //    " background-color: rgba(255, 0, 0, 0.5);\n" +
        "}\n" +
        "</style>\n" +
        "<div id='cover' class='cover_closed'></div>" +
        "<div id='container' class='container container_closed' tabindex='0'><content></content></div>";
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private __getById(id:string) {
    return util.getShadowRoot(this).querySelector('#'+id);
  }

  createdCallback() {
    var cover: HTMLDivElement;
    var container: HTMLDivElement;
    var shadow = util.createShadowRoot(this);
    var clone = this.createClone();
    shadow.appendChild(clone);

    cover = this.__getById('cover');
    cover.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (ev.button === 0) {
        this.close();
      }
    });

    cover.addEventListener('contextmenu', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      this.close();
    }, true);

    container = this.__getById('container');
    container.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    });

    container.addEventListener('mousemove', (ev: MouseEvent) => {
      if (ev.srcElement.nodeName === 'CB-MENUITEM' || ev.srcElement.nodeName === 'CB-CHECKBOXMENUITEM') {
        this.selectMenuItem(this.childNodes, ev.srcElement);
      } else {
        this.selectMenuItem(this.childNodes, null);
      }
    });

    container.addEventListener('mouseleave', (ev: MouseEvent) => {
      this.selectMenuItem(this.childNodes, null);
    });

    container.addEventListener('click', (ev: MouseEvent) => {
      var item:menuitem;

      if (ev.srcElement instanceof menuitem) {
        item = <menuitem>ev.srcElement;
        this.activateItem.call(self, item);
      }
    });

    container.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
    container.addEventListener('keypress', (ev: KeyboardEvent) => { this.handleKeyPress(ev); });
  }

  private fetchCbMenuItems(kids: NodeList): menuitem[] {
    var i: number;
    var len: number;
    var result: menuitem[];
    var item: Node;

    len = kids.length;
    result = [];
    for (i=0; i<len; i++) {
      item = kids[i];

      if(item instanceof menuitem) {
        result.push(<menuitem>item);
      }
    }
    return result;
  }

  private selectMenuItem(kids: NodeList, selectitem: Element) {
    var i: number;
    var len: number;
    var item: Node;

    len = kids.length;
    for (i=0; i<len; i++) {
      item = kids[i];

      if (item instanceof menuitem) {
        (<menuitem>item).setAttribute('selected', selectitem === item ? "true" : "false");
      }
    }
  }

  private handleKeyDown(ev: KeyboardEvent) {
    var keyboardselected: menuitem[];
    var menuitems: menuitem[];
    var i: number;

    // Escape.
    if (ev.keyIdentifier === "U+001B") {
      this.close();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (ev.keyIdentifier === "Up" || ev.keyIdentifier === "Down" || ev.keyIdentifier === "Enter") {
      menuitems = this.fetchCbMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      keyboardselected = menuitems.filter( (item:menuitem) => util.htmlValueToBool(item.getAttribute("selected")));

      if (ev.keyIdentifier === "Up") {
        if (keyboardselected.length === 0) {
          this.selectMenuItem(this.childNodes, menuitems[menuitems.length-1]);
        } else {
          i = menuitems.indexOf(keyboardselected[0]);
          i = i === 0 ? menuitems.length-1 : i-1;
          this.selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else if (ev.keyIdentifier === "Down") {
        if (keyboardselected.length === 0) {
          this.selectMenuItem(this.childNodes, menuitems[0]);
        } else {
          i = menuitems.indexOf(keyboardselected[0]) + 1;
          if (i === menuitems.length) {
            i = 0;
          }
          this.selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else {
        // Enter
        ev.stopPropagation();
        return;
      }
    }
    ev.preventDefault();
    ev.stopPropagation();
  }

  private activateItem(item: menuitem) {
    var name: string;
    var checked: string;
    var event: CustomEvent;

    item._clicked();

    name = item.getAttribute('name');
    checked = item.getAttribute('checked');
    this.close();

    event = new CustomEvent('selected', { detail: {name: name, checked: checked } });
    this.dispatchEvent(event);
  }

  private handleKeyPress(ev: KeyboardEvent) {
    var keyboardselected: menuitem[];
    var menuitems: menuitem[];

    ev.preventDefault();
    ev.stopPropagation();

    if (ev.keyIdentifier === "Enter") {
      menuitems = this.fetchCbMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      keyboardselected = menuitems.filter( (item:menuitem) => util.htmlValueToBool(item.getAttribute("selected")) );

      if (keyboardselected.length !== 0) {
        this.activateItem(keyboardselected[0]);
      }
    }  
  }

  open(x: number, y: number) {
    var sx: number;
    var sy: number;
    var cover: HTMLDivElement;
    var container: HTMLDivElement;
    var rect: ClientRect;

    container = this.__getById('container');
    container.classList.remove('container_closed');  
    container.classList.add('container_open');  

    rect = container.getBoundingClientRect();

    sx = x;
    if (sx+rect.width > window.innerWidth) {
      sx = window.innerWidth - rect.width;
    }

    sy = y;
    if (sy+rect.height > window.innerHeight) {
      sy = window.innerHeight - rect.height;
    }

    container.style.left = "" + sx + "px";
    container.style.top = "" + sy + "px";

    cover = this.__getById('cover');
    cover.className = "cover_open";

    this.selectMenuItem(this.childNodes, null);

    container.focus();
  }

  private debugScroll(msg?: string) {
    var text = msg !== undefined ? msg : "";
    var termdiv = window.document.querySelector('div.terminal');
    console.log(text + " -- termdiv.scrollTop: " + termdiv.scrollTop);

    var active = window.document.activeElement;
    console.log("active element: " + active);
    if (active !== null) {
      console.log("active element nodeName: " + active.nodeName);
      console.log("active element class: " + active.getAttribute('class'));
    }
  }

  openAround(el: HTMLElement) {
    var sx: number;
    var sy: number;
    var elrect: ClientRect;
    var containerrect: ClientRect;
    var container: HTMLDivElement;
    var cover: HTMLDivElement;

    elrect = el.getBoundingClientRect();

    container = this.__getById('container');
    container.classList.remove('container_closed');  
    container.classList.add('container_open');  
    containerrect = container.getBoundingClientRect();

    sx = elrect.left;
    if (sx+containerrect.width > window.innerWidth) {
      sx = window.innerWidth - containerrect.width;
    }

    sy = elrect.bottom;
    if (sy+containerrect.height > window.innerHeight) {
      sy = elrect.top - containerrect.height;
    }

    container.style.left = "" + sx + "px";
    container.style.top = "" + sy + "px";

    cover = this.__getById('cover');
    cover.className = "cover_open";

    this.selectMenuItem(this.childNodes, null);

    container.focus();
  }

  close() {
    var event = new CustomEvent('before-close', { detail: null });
    this.dispatchEvent(event);

    var cover = this.__getById('cover');
    cover.className = "cover_closed";

    var container = this.__getById('container');
    container.classList.remove('container_open');  
    container.classList.add('container_closed');

    event = new CustomEvent('close', { detail: null });
    this.dispatchEvent(event);
  }
}
console.log('contextmenu run');
window.document.registerElement('cb-contextmenu', {prototype: CbContextMenu.prototype});
export = CbContextMenu;
