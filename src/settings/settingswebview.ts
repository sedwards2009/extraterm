/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import sourceMapSupport = require('source-map-support');
import icepick = require('icepick');
import Messages = require('../windowmessages');
import webipc = require('../webipc');
import config = require('../config');
import Theme = require('../theme');
import im = require('immutable');
import React = require('react');
import settingspane = require('./settingspane');

type Config = config.Config;

let configuration: Config = null;
let themes: im.Map<string, Theme>;

export function startUp(): void {
  webipc.start();
  
  const doc = window.document;
  
  // Default handling for config messages.
  webipc.registerDefaultHandler(Messages.MessageType.CONFIG, handleConfigMessage);
  
  // Default handling for theme messages.
  webipc.registerDefaultHandler(Messages.MessageType.THEMES, handleThemesMessage);

  const allPromise = Promise.all<void>( [webipc.requestConfig().then(handleConfigMessage),
                      webipc.requestThemes().then(handleThemesMessage)] );
  allPromise.then( (): void => {
    const pane = React.createElement(settingspane.SettingsPane,
                  {config: configuration, onConfigChange: handleConfigChange});
    React.render(pane, document.getElementById('settingspanenode'));
  });

}

function handleConfigMessage(msg: Messages.Message): void {
  const configMessage = <Messages.ConfigMessage> msg;
  configuration = configMessage.config;
  icepick.freeze(configuration);
  // setupConfiguration(configMessage.config);
}

function handleThemesMessage(msg: Messages.Message): void {
  const themesMessage = <Messages.ThemesMessage> msg;
  themes = im.Map<string, Theme>();
  themesMessage.themes.forEach( (item: Theme) => {
    themes = themes.set(item.name, item);
  });
}

function handleConfigChange(newConfig: Config): void {
  webipc.sendConfig(newConfig);
}
