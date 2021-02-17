/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { objectName, getLogger, Logger } from "extraterm-logging";

/**
 * Convert an array-like object to a real array.
 *
 * @param {Object} fakeArray An array-like object with get() and length support.
 * @return {Array} A real array object with the elements as fakeArray.
 */
export function toArray<T>(fakeArray: { [key: number]: T; length: number; }): T[] {
  const result: T[] = [];

  const len = fakeArray.length;
  for (let i=0; i<len; i++) {
    result.push(fakeArray[i]);
  }
  return result;
}

export interface LeftRightPair {
  left: Node[];
  right: Node[];
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

const _log = getLogger("DomUtils.focusElement()");
const LOG_FOCUS_ELEMENT = false;
const DEBUG_FOCUS_ELEMENT = false;

/**
 * Focus an element
 *
 * This calls `focus()` on an element but also includes extra internal
 * facilities for logging calls and for checking that the `focus()` call was
 * successful.
 *
 * @param target the element to focus.
 * @param callerLogger Logger object from the caller.
 * @param preventScroll This corresponds to the `preventScroll` parameter to
 *   `HTMLElement.focus()`.
 */
export function focusElement(target: HTMLElement, callerLogger: Logger=null, preventScroll=false): void {
  let targetName = "";
  if (LOG_FOCUS_ELEMENT) {
    targetName = objectName(target);
    if (targetName == null) {
      targetName = target.tagName;
    }
    if (callerLogger != null) {
      _log.debug(`Calling focus() on ${targetName} from ${callerLogger.getName()}`);
    } else {
      _log.debug(`Calling focus() on ${targetName}`);
    }
  }

  target.focus({ preventScroll });

  if (DEBUG_FOCUS_ELEMENT) {
    const pairs = findParentChildFocusPairs(target);
    if ( ! checkParentChildFocusPairs(pairs)) {
      debugParentChildFocusPairs(pairs);
    }
  }

  if (LOG_FOCUS_ELEMENT) {
    _log.debug(`Done focus() on ${targetName}`);
  }
}

interface TreeChildPair {
  child: HTMLElement;
  root: Document | ShadowRoot;
}

function findParentChildFocusPairs(target: HTMLElement): TreeChildPair[] {
  const parentNodes = nodePathToRoot(target);

  const pairs: TreeChildPair[] = [];
  let currentPair: TreeChildPair = {
    child: target,
    root: null
  };

  for (let i=0; i<parentNodes.length; i++) {
    const node = parentNodes[i];
    if (currentPair) {
      if (node instanceof ShadowRoot || node instanceof Document) {
        currentPair.root = node;
        pairs.push(currentPair);
        currentPair = null;
      }
    } else {
      currentPair = {
        child: <HTMLElement> node,
        root: null
      };
    }
  }
  return pairs;
}

function checkParentChildFocusPairs(pairs: TreeChildPair[]): boolean {
  for (const pair of pairs) {
    if (pair.root.activeElement !== pair.child) {
      return false;
    }
  }
  return true;
}

function debugParentChildFocusPairs(pairs: TreeChildPair[]): void {
  const parts: string[] = [];

  parts.push("Deepest first");

  for (const pair of pairs) {
    if (pair.root.activeElement !== pair.child) {
      parts.push(`! ${formatNodeName(pair.root)} active element != ${formatNodeName(pair.child)}`);
    } else {
      parts.push(`  ${formatNodeName(pair.root)} active element == ${formatNodeName(pair.child)}`);
    }
  }
  _log.warn(parts.join("\n"));
}

/**
 * Get a human readable name for a node.
 *
 * @param node
 * @return human readable name
 */
function formatNodeName(node: Node): string {
  const name = objectName(node);
  if (name != null) {
    return name;
  }
  if (node instanceof HTMLElement) {
    return node.tagName;
  }
  if (node instanceof ShadowRoot) {
    return `ShadowRoot of ${formatNodeName(node.host)}`;
  }
  return "" + node;
}

function focusParents(pairs: TreeChildPair[]): void {
  for (let i=pairs.length-1; i>=0; i--) {
    const pair = pairs[i];
    if (pair.root.activeElement !== pair.child) {
      pair.child.focus();
    }
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
 * Convert a length with 'px' suffix to a plain float.
 *
 * @param length the length value as a string
 * @return the length as a number
 */
export function pixelLengthToFloat(length: string | number): number {
  if (typeof length === "string") {
    const lengthStr = length.indexOf("px") !== -1 ? length.substr(0, length.length-2) : length;
    return parseFloat(lengthStr);
  } else {
    return length;
  }
}

/**
 * Convert a length with 'px' suffix to a plain integer.
 *
 * @param length the length value as a string
 * @return the length as a number
 */
export function pixelLengthToInt(length: string | number): number {
  if (typeof length === "string") {
    return Math.floor(pixelLengthToFloat(length));
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
    } else if (currentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (<ShadowRoot> currentNode).host != null) {
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
    } else if (currentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (<ShadowRoot> currentNode).host != null) {
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

export function findFixedPositionOffset(element: HTMLElement): { left: number, top: number } {
  const nodePath = nodePathToRoot(element);
  for (const node of nodePath) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      if (style.position !== "static") {
        const pos = node.getBoundingClientRect();
        return { left: pos.left, top: pos.top };
      }
    }
  }
  return { left: 0, top: 0 };
}

/**
 * Disassemble all of the node below a DOM subtree
 *
 * This removes all the child nodes from every child and grandchild etc in
 * the subtree.
 *
 * @param subtree The DOM tree to disassemble
 */
export function disassembleDOMTree(subtree: ChildNode | ShadowRoot): void {
  if (subtree == null) {
    return;
  }
  for (const node of subtree.childNodes) {
    disassembleDOMTree(node);
    subtree.removeChild(node);
  }
}
