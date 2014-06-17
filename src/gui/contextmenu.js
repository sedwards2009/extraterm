define(["require", "gui/menuitem", "gui/util"], function(require, menuitem, util) {
var ID = "CbContextMenuTemplate";

/**
 * A context menu.
 */
var CbContextMenuProto = Object.create(window.HTMLElement.prototype);

function createClone() {
  var template = window.document.getElementById(ID);
  if (template === null) {
    template = window.document.createElement('template');
    template.id = ID;
    template.innerHTML = "<style>\n"
      + ".container {\n"
      + "    position: fixed;\n"
      + "    background-color: #F4F4F4;\n"
      + "    border-radius: 4px;\n"
      + "    padding: 4px 0px 4px 0px;\n"
      + "    width: 15rem;\n"
      + "    box-shadow: 0px 0px 8px black;\n"
      + "    z-index: 101;\n"
      + "}\n"
      
      + ".container_closed {\n"
      + "    display: none;\n"
      + "}\n"
      
      + ".container_open {\n"
      + "\n"
      + "}\n"
      
      + ".cover_closed {\n"
      + "    visibility: hidden;\n"
      + "}\n"
      + ".cover_open {\n"
      + "    visibility: visible;\n"
      + "    position: fixed;\n"
      + "    left: 0px;\n"
      + "    right: 0px;\n"
      + "    top: 0px;\n"
      + "    bottom: 0px;\n"
      + "    z-index: 100;\n"
//      + " background-color: rgba(255, 0, 0, 0.5);\n"
      + "}\n"
      + "</style>\n"
      + "<div id='cover' class='cover_closed'></div>"
      + "<div id='container' class='container container_closed' tabindex='0'><content></content></div>";
      
    window.document.body.appendChild(template);
  }
  
  return window.document.importNode(template.content, true);
}

CbContextMenuProto.__getById = function(id) {
  return util.getShadowRoot(this).querySelector('#'+id);
};

CbContextMenuProto.createdCallback = function() {
  var cover;
  var container;
  var self = this;
  var shadow = util.createShadowRoot(this);
//  shadow.applyAuthorStyles = true;
  
  var clone = createClone();
  shadow.appendChild(clone);
  
  cover = this.__getById('cover');
  cover.addEventListener('mousedown', function(ev) {
    if (ev.button === 0) {    
      ev.stopPropagation();
      ev.preventDefault();
      self.close();
    }
  });
  
  cover.addEventListener('contextmenu', function(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    self.close();
  }, true);
  
  container = this.__getById('container');
  container.addEventListener('mousedown', function(ev) {
    ev.stopPropagation();
    ev.preventDefault();
  });
  
  container.addEventListener('mousemove', function(ev) {
    if (ev.srcElement.nodeName === 'CB-MENUITEM' || ev.srcElement.nodeName === 'CB-CHECKBOXMENUITEM') {
      selectMenuItem(self.childNodes, ev.srcElement);
    } else {
      selectMenuItem(self.childNodes, null);
    }
  });
  
  container.addEventListener('mouseleave', function(ev) {
    selectMenuItem(self.childNodes, null);
  });
  
  container.addEventListener('click', function(ev) {
    var name;
    var event;
    var checked;
    var item;

    if (ev.srcElement instanceof menuitem) {
      item = ev.srcElement;
      item._clicked();
      
      name = item.getAttribute('name');
      checked = item.getAttribute('checked');
      self.close();
      
      event = new window.CustomEvent('selected', { detail: {name: name, checked: checked } });
      this.dispatchEvent(event);
    }
  });
  container.addEventListener('keydown', function(ev) {
    handleKeyDown.call(self, ev);
  });
  
};

function fetchCbMenuItems(kids) {
  var i;
  var len;
  var result;
  var item;
  
  len = kids.length;
  result = [];
  for (i=0; i<len; i++) {
    item = kids[i];
    
    if(item instanceof menuitem) {
      result.push(item);
    }
  }
  return result;
}

function selectMenuItem(kids, selectitem) {
  var i;
  var len;
  var item;

  len = kids.length;
  for (i=0; i<len; i++) {
    item = kids[i];
    
    if (item instanceof menuitem) {
      item.setAttribute('selected', '' + (selectitem === item) );
    }
  }
}

function handleKeyDown(ev) {
  var keyboardselected;
  var menuitems;
  var i;
  var name;
  
  ev.preventDefault();
  
  // Escape.
  if (ev.keyIdentifier === "U+001B") {
    this.close();
    return;
  }
  
  if (ev.keyIdentifier === "Up" || ev.keyIdentifier === "Down" || ev.keyIdentifier === "Enter") {
    menuitems = fetchCbMenuItems(this.childNodes);
    if (menuitems.length === 0) {
      return;
    }

    keyboardselected = menuitems.filter(function(item) {
      var value;
      value = item.getAttribute("selected");
      return value === "true" || value === true;
    });

    if (ev.keyIdentifier === "Up") {
      if (keyboardselected.length === 0) {
        selectMenuItem(this.childNodes, menuitems[menuitems.length-1]);
      } else {
        i = menuitems.indexOf(keyboardselected[0]);
        i = i === 0 ? menuitems.length-1 : i-1;
        selectMenuItem(this.childNodes, menuitems[i]);
      }
    } else if (ev.keyIdentifier === "Down") {
      if (keyboardselected.length === 0) {
        selectMenuItem(this.childNodes, menuitems[0]);
      } else {
        i = menuitems.indexOf(keyboardselected[0]) + 1;
        if (i === menuitems.length) {
          i = 0;
        }
        selectMenuItem(this.childNodes, menuitems[i]);
      }
    } else {
      // Enter
      if (keyboardselected.length !== 0) {
        name = keyboardselected[0].getAttribute('name');
        this.close();

        var event = new CustomEvent('selected', { detail: name });
        this.dispatchEvent(event);
      }
    }
    return;
  }
};

CbContextMenuProto.open = function(x, y) {
  var sx;
  var sy;
  var cover;
  var container;
  var rect;

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
  
  selectMenuItem(this.childNodes, null);
  
  container.focus();
};

CbContextMenuProto.openAround = function(el) {
  var sx;
  var sy;
  var elrect;
  var containerrect;
  var container;
  var cover;
  
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
  
  selectMenuItem(this.childNodes, null);
  
  container.focus();
};

CbContextMenuProto.close = function() {
  var cover = this.__getById('cover');
  cover.className = "cover_closed";
  
  var container = this.__getById('container');
  container.classList.remove('container_open');  
  container.classList.add('container_closed');  
};

var CbContextMenu = window.document.registerElement('cb-contextmenu', {prototype: CbContextMenuProto});
return CbContextMenu;
});
