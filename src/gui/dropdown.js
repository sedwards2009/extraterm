define([], function() {
var ID = "CbDropDownTemplate";

/**
 * A Drop Down.
 */
var CbDropDownProto = Object.create(HTMLElement.prototype);

function createClone() {
  var template = document.getElementById(ID);
  if (template === null) {
    template = document.createElement('template');
    template.id = ID;
    template.innerHTML = "\n"
      + "<div><content select='cb-contextmenu'></content></div>"
      + "<div><content></content></div>";
    document.body.appendChild(template);
  }

  return document.importNode(template.content, true);
}

function getById(self, id) {
  return self.webkitShadowRoot.querySelector('#'+id);
};

CbDropDownProto.createdCallback = function() {
  var i;
  var len;
  var kid;
  var self = this;
  var shadow = this.webkitCreateShadowRoot();
  shadow.applyAuthorStyles = true;
  
  var clone = createClone();
  shadow.appendChild(clone);
  
  len = this.childNodes.length;
  for (i=0; i<len; i++) {
    kid = this.childNodes[i];
    if (kid.nodeName.slice(0,1) !== '#' && kid.nodeName !== 'CB-CONTEXTMENU') {
      kid.addEventListener('click', function(ev) {
        var cm = self.querySelector('cb-contextmenu');
        cm.openAround(this);        
      });
    }
  }
  
};

var CbDropDown = document.registerElement('cb-dropdown', {prototype: CbDropDownProto});
return CbDropDown;
});
