/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as Util from './gui/Util';

/**
 * Convert an array-like object to a real array.
 * 
 * @param {Object} fakeArray An array-like object with get() and length support.
 * @return {Array} A real array object with the elements as fakeArray.
 */
export function toArray<T>(fakeArray: { [key: number]: T; length: number; }): T[] {
  var result: T[] = [];

  var len = fakeArray.length;
  for (var i=0; i<len; i++) {
    result.push(fakeArray[i]);
  }
  return result;
}

export interface LeftRightPair {
  left: Node[];
  right: Node[];
}

/**
 * Split child nodes at a character offset.
 * 
 * @param {Node} rootNode The node whose child nodes are to be split.
 * @param {number} charOffset The character offset to split at.
 * @return {Object} An object of the form {left: array, right: array}
 *     containing arrays of the child nodes left of, and right of the
 *     character offset.
 */
export function splitNodeContentsAtChar(rootNode: Node, charOffset: number): LeftRightPair {
  var newoffset: number;
  var newNode: Node;

  var kids = toArray(rootNode.childNodes);
  var len = kids.length;
  var offset = 0;
  if (charOffset === 0) {
    return {left: [], right: kids};
  }

  for (var i=0; i<len; i++) {
    var kid = kids[i];
    if (kid.nodeName === "#text") {
      newoffset = offset + kid.nodeValue.length;
      if (newoffset === charOffset) {
        return {left: kids.slice(0,i+1), right: kids.slice(i+1)};
      }
      if (newoffset > charOffset) {
        newNode = kid.ownerDocument.createTextNode(kid.nodeValue.slice(0, charOffset-offset));
        kid.nodeValue = kid.nodeValue.slice(charOffset-offset);
        rootNode.insertBefore(newNode, kid);
        return {left: kids.slice(0,i).concat(newNode), right: kids.slice(i)};
      }
    } else {

      // Assume a normal node.
      newoffset = offset + kid.textContent.length;
      if (newoffset === charOffset) {
        return {left: kids.slice(0,i+1), right: kids.slice(i+1)};
      }
      if (newoffset > charOffset) {
        var parts = splitNodeContentsAtChar(kid, charOffset-offset);
        newNode = kid.cloneNode(false);
        parts.left.forEach(function(node) {
          newNode.appendChild(node);
        });
        rootNode.insertBefore(newNode, kid);
        return {left: kids.slice(0,i).concat(newNode), right: kids.slice(i)};
      }
    }
    offset = newoffset;
  }

  return {left: kids, right: []};
}

export function encloseCharRange(rootNode: Node, startOffset: number, endOffset: number, newNode: Node) {
  var split1Results = splitNodeContentsAtChar(rootNode, startOffset);
  var nodeStartOffset = split1Results.left.length;    
  var split2Results = splitNodeContentsAtChar(rootNode, endOffset);
  var nodeEndOffset = split2Results.left.length;
  var kids = toArray(rootNode.childNodes).slice(nodeStartOffset, nodeEndOffset);

  kids.forEach(function(kid) {                 
    newNode.appendChild(kid);
  });

  insertNodeAt(rootNode, nodeStartOffset, newNode);
}

/**
 * Insert a node under a parent node at an offset.
 * 
 * @param {Node} rootNode
 * @param {number} offset
 * @param {Node} newNode
 */
export function insertNodeAt(rootNode: Node, offset: number, newNode: Node): void {
  if (offset >= rootNode.childNodes.length) {
    rootNode.appendChild(newNode);
  } else {
    rootNode.insertBefore(newNode, rootNode.childNodes[offset]);
  }
}

/**
 * Extracts formatted plain text from a document range.
 *
 * @param range the range to scan and extract the text from.
 * @return the formatted plain text representation.
 */
export function extractTextFromRange(range: Range): string {
  const nbspRegexp = /\u00a0/g;
  
  const startContainer = range.startContainer;
  const endContainer = range.endContainer;
  let result = "";
  
  // Use case where the start and end of the range are inside the same text node.
  if (startContainer === range.endContainer) {
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = <Text> startContainer;
      return textNode.data.slice(range.startOffset, range.endOffset).replace(nbspRegexp, " ");
    }
  }
  
  let currentNode: Node;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    result += (<Text> startContainer).data.slice(range.startOffset).replace(nbspRegexp, " ");
    currentNode = nextDocumentOrderNode(startContainer);
  } else {
    currentNode = startContainer.childNodes[range.startOffset];
  }

  const endNode = endContainer.nodeType === Node.TEXT_NODE ? endContainer : endContainer.childNodes[range.endOffset];
  
  while (currentNode !== endNode && currentNode !== null) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      result += (<Text> currentNode).data.replace(nbspRegexp, " ");
      
    } else if (currentNode.nodeName === "DIV") {
      const divElement = <HTMLDivElement> currentNode;
      if (divElement.classList.contains('terminal-active') || divElement.classList.contains('terminal-scrollback')) {
        result = Util.trimRight(result) + "\n";
      }
    }
    
    currentNode = nextDocumentOrderNode(currentNode);
  }
  
  if (endContainer.nodeType === Node.TEXT_NODE) {
    result += (<Text> endContainer).data.slice(0, range.endOffset).replace(nbspRegexp, " ");
  }
  
  return result;
}

function nextDocumentOrderNode(currentNode: Node): Node {
  if (currentNode.childNodes.length !== 0) {
    return currentNode.childNodes[0];
  }
  
  if (currentNode.nextSibling !== null) {
    return currentNode.nextSibling;
  }
  
  return nextDocumentOrderNodeUp(currentNode.parentNode);
}

function nextDocumentOrderNodeUp(currentNode: Node): Node {
  if (currentNode.nextSibling !== null) {
    return currentNode.nextSibling;
  }
  return nextDocumentOrderNodeUp(currentNode.parentNode);
}

export function getShadowRoot(self: Element): ShadowRoot {
    return self.webkitShadowRoot ? self.webkitShadowRoot : self.shadowRoot;
}

export function getShadowId(el: HTMLElement, id: string): HTMLElement {
  const shadowRoot = getShadowRoot(el);
  if (shadowRoot === null) {
    return null;
  }
  return <HTMLElement> shadowRoot.querySelector('#' + id);
}

/**
 * Converts a node list to a real array.
 * 
 * @param  nodeList the node list to convert.
 * @return          a new array holding the same contents as the node list.
 */
export function nodeListToArray(nodeList: NodeList): Node[] {
  let i = 0;
  const result: Node[] = [];
  const len = nodeList.length;
  for (i=0; i<len; i++) {
    result.push(nodeList[i]);
  }
  return result;
}

/**
 * Create a KeyboardEvent.
 *
 * This works around a bunch of bugs in Blink.
 * 
 * @param  eventName event name, one of 'keypress', 'keydown' and 'keyup'
 * @param  initMap map of values to use to fill the event
 * @return new keyboard event
 */
export function newKeyboardEvent(eventName: string, initMap: {
      bubbles?: boolean;
      key?: string;
      code?: string;
      location?: number;
      repeat?: boolean;
      keyCode?: number;
      charCode?: number;
      which?: number;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
    }): KeyboardEvent {
  
  const fakeKeyDownEvent = new KeyboardEvent(eventName, initMap);

  // https://stackoverflow.com/questions/12937391/cannot-initialize-keycode-in-keyboard-event-init-method      
  Object.defineProperty(fakeKeyDownEvent, 'keyCode', {
    get: function() {
      return initMap.keyCode;
    }
  });
  
  Object.defineProperty(fakeKeyDownEvent, 'charCode', {
    get: function() {
      return initMap.charCode;
    }
  });

  Object.defineProperty(fakeKeyDownEvent, 'code', {
    get: function() {
      return initMap.code;
    }
  });

  Object.defineProperty(fakeKeyDownEvent, 'which', {
    get: function() {
      return initMap.which;
    }
  });
  return fakeKeyDownEvent;
}

/**
 * Add an event listener which blocks an event and retransmits it.
 * 
 * @param listenTarget    the object on which to intercept the custom event
 * @param eventName the name of the Custom Event to intercept and retransmit
 * @param retransmitTarget (Optional) the element on which to retransmit the event
 */
export function addCustomEventResender(listenTarget: EventTarget, eventName: string,
      retransmitTarget: EventTarget=null): void {

  listenTarget.addEventListener(eventName, (ev: CustomEvent) => {
    const inflightResentEvent = inflightResentEvents.get(ev.target);
    if (inflightResentEvent === ev && inflightResentEvent.type === eventName) {
      return;
    }
    ev.stopPropagation();
    const detail = ev.detail;
    const bubbles = ev.bubbles;
    
    const event = new CustomEvent(eventName, { bubbles: bubbles, detail: detail });
    inflightResentEvents.set(listenTarget, event);
    (retransmitTarget === null ? listenTarget : retransmitTarget).dispatchEvent(event);
    inflightResentEvents.delete(listenTarget);
  });
}

const inflightResentEvents = new Map<EventTarget, CustomEvent>();

//-------------------------------------------------------------------------

/**
 * Format a Uint8Array and mimetype as a data url.
 * 
 * @param  buffer   [description]
 * @param  mimeType [description]
 * @return          [description]
 */
export function CreateDataUrl(buffer: Buffer, mimeType: string): string {
  const base64Data = buffer.toString('base64');
  return "data:" + mimeType + ";base64," + base64Data;
}

export function getEventDeepPath(ev: Event): Node[] {
  return ev.composedPath();
}

/**
 * Set the input focus on an element and prevent any scrolling for occuring.
 *
 * @param el the element to focus
 */
export function focusWithoutScroll(el: HTMLElement): void {
  const preScrollTops: {element: Element, top: number}[] = [];

  let p: Element = el;
  do {
    preScrollTops.push( { element: p, top: p.scrollTop } );


    let parent: Element = p.parentElement;
    if (parent == null) {
      const nodeParent = p.parentNode;
      if (nodeParent != null && nodeParent.nodeName === "#document-fragment") {
        parent = (<ShadowRoot> nodeParent).host;
      }
    }
    p = parent;
  } while (p != null);

  el.focus();

  if (preScrollTops.length !== 0) {
    // Restore the previous scroll top values.
    preScrollTops.forEach( (pair) => {
      if (pair.element.scrollTop !== pair.top) {
        pair.element.scrollTop = pair.top;
      }
    });
  }
}

/**
 * Prevent an Element from scrolling.
 * 
 * @param el the element to prevent all scrolling on.
 */
export function preventScroll(el: HTMLElement): void {
  el.addEventListener('scroll', (ev) => {
    el.scrollTop = 0;
  }, true);
  el.addEventListener('scroll', (ev) => {
    el.scrollTop = 0;
  });
}


/**
 * Convert a length with 'px' suffix to a plain integer.
 *
 * @param length the length value as a string
 * @return the length as a number
 */
export function pixelLengthToInt(length: string | number): number {
  if (typeof length === "string") {
    const lengthStr = length.indexOf("px") !== -1 ? length.substr(0, length.length-2) : length;    
    return parseInt(lengthStr, 10);
  } else {
    return length;
  }
}

/**
 * Expand a HTML string into Document Fragment.
 * 
 * @param {html} the HTML code to use.
 * @return A Document Fragment containing the nodes defined by the `html` parameter.
 */
export function htmlToFragment(html: string): DocumentFragment {
  const div = document.createElement("DIV");
  div.innerHTML = html;
  const frag = document.createDocumentFragment();
  while (div.childNodes.length !== 0) {
    frag.appendChild(div.childNodes[0]);
  }
  return frag;
}

/**
 * Update the list of children on an element.
 * 
 * This function updates the children while trying to do as few changes on
 * the DOM as possible.
 * 
 * @param el the Element to update.
 * @param targetChildrenList the desired list of child elements.
 */
export function setElementChildren(el: Element, targetChildrenList: Element[]): void {
  // Delete phase
  const unneededChildrenSet = new Set<Element>(toArray(el.children));
  for (const kid of targetChildrenList) {
    unneededChildrenSet.delete(kid);
  }
  for (const kid of unneededChildrenSet) {
    el.removeChild(kid);
  }

  // Insert the missing children and fix the order.
  for (let i=0; i < targetChildrenList.length; i++) {
    if (el.children.length <= i) {
      el.appendChild(targetChildrenList[i]);
    } else {
      if (el.children.item(i) !== targetChildrenList[i]) {
        el.insertBefore(targetChildrenList[i], el.children.item(i));
      }
    }
  }
}

/**
 * Test if a node is in the DOM tree.
 * 
 * @param node the node to test
 * @return true if the node is attached somewhere inside its DOM tree.
 */
export function isNodeInDom(node: Node): boolean {
  let currentNode = node;
  let nextNode = node;

  while (true) {
    currentNode = nextNode;
    if (currentNode.parentNode != null) {
      nextNode = currentNode.parentNode;
    } else if (currentNode.nodeType == Node.DOCUMENT_FRAGMENT_NODE && (<ShadowRoot> currentNode).host != null) {
      nextNode = (<ShadowRoot> currentNode).host;
    } else {
      break;
    }
  }

  return currentNode.nodeType === Node.DOCUMENT_NODE;
}

/**
 * Remove all CSS classes from an element.
 */
export function removeAllClasses(el: Element): void {
  while (el.classList.length !== 0) {
    el.classList.remove(el.classList[0]);
  }
}

/**
 * Get the path from the node through its parents, to the root.
 * 
 * This function will also traverse shadow DOM boundaries.
 * 
 * @param node the node
 * @return the path from the node to its root parent with nodes closer to the
 *         start node first and the ultimate parent node last.
 */
export function nodePathToRoot(node: Node): Node[] {
  let currentNode = node;
  let nextNode = node;
  const path: Node[] = [];

  while (true) {
    currentNode = nextNode;
    if (currentNode.parentNode != null) {
      nextNode = currentNode.parentNode;
      path.push(nextNode);
    } else if (currentNode.nodeType == Node.DOCUMENT_FRAGMENT_NODE && (<ShadowRoot> currentNode).host != null) {
      nextNode = (<ShadowRoot> currentNode).host;
      path.push(nextNode);
    } else {
      break;
    }
  }
  return path;
}

/**
 * Get the list of active/focused elements and their nested active elements.
 * 
 * This function traverses Shadow DOM boundaries to find nested
 * active/focused elements starting from the top window.
 * 
 * @returns list of active elements
 */
export function activeNestedElements(): Element[] {
  const result: Element[] = [];

  let activeElement = window.document.activeElement;
  if (activeElement != null) {

    while (true) {
      result.push(activeElement);
      const shadowRoot = getShadowRoot(<HTMLElement> activeElement);
      if (shadowRoot == null) {
        break;
      }
      const nextActiveElement = shadowRoot.activeElement;
      if (nextActiveElement == null) {
        break;
      }
      activeElement = nextActiveElement;
    }
  }
  return result;
}
