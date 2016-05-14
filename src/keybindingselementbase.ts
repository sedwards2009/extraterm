/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import domutils = require('./domutils');
import ThemeableElementBase = require('./themeableelementbase');
import KeyBindingManager = require('./keybindingmanager');

let keyBindingContexts: KeyBindingManager.KeyBindingContexts = null;

const instanceRegistry = new Set<KeyBindingsElementBase>();

/**
 * A base class for HTMLElements which also want theming CSS support.
 */
class KeyBindingsElementBase extends ThemeableElementBase {

  static setKeyBindingContexts(contexts: KeyBindingManager.KeyBindingContexts) {
    keyBindingContexts = contexts;
    instanceRegistry.forEach( (instance) => {
      instance.keyBindingContextsChanged(contexts);
    });
  }
  
  /**
   * Custom Element 'attached' life cycle hook.
   */
  protected attachedCallback(): void {
    instanceRegistry.add(this);
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  protected detachedCallback(): void {
    instanceRegistry.delete(this);
  }  
  
  get keyBindingContexts(): KeyBindingManager.KeyBindingContexts {
    return keyBindingContexts;
  }
  
  // Overrideable no-op.
  protected keyBindingContextsChanged(contexts: KeyBindingManager.KeyBindingContexts) {
  }
}

export = KeyBindingsElementBase;
