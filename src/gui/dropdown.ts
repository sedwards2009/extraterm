///<reference path='../chrome_lib.d.ts'/>
import CbContextMenu = require('gui/contextmenu');
import util = require('./util');

var ID = "CbDropDownTemplate";

/**
 * A Drop Down.
 */
class CbDropDown extends HTMLElement {
  
  private createClone() {
    var template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "\n" +
        "<div><content select='cb-contextmenu'></content></div>" +
        "<div><content></content></div>";
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  createdCallback() {
    var i: number;
    var len: number;
    var kid: Node;
    var shadow: HTMLElement;
    var cm: CbContextMenu;
    var clickHandler: (ev: MouseEvent) => void;
    var clone: Node;

    shadow = util.createShadowRoot(this);
    clone = this.createClone();
    shadow.appendChild(clone);

    clickHandler = (ev: MouseEvent) => {
      var cm = <CbContextMenu>this.querySelector('cb-contextmenu');
      cm.openAround(this);        
    };

    len = this.childNodes.length;
    for (i=0; i<len; i++) {
      kid = this.childNodes[i];
      if (kid.nodeName.slice(0,1) !== '#' && kid.nodeName !== 'CB-CONTEXTMENU') {
        kid.addEventListener('click', clickHandler);
      }
    }

    cm = <CbContextMenu>this.querySelector('cb-contextmenu');  
    cm.addEventListener('selected', (ev: MouseEvent) => {
        var event = new window.CustomEvent('selected', { detail: ev.detail });
        this.dispatchEvent(event);
    });
  }
}

window.document.registerElement('cb-dropdown', {prototype: CbDropDown.prototype});
export = CbDropDown;
