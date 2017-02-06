import PluginApi = require('./PluginApi');

export interface InternalExtratermApi extends PluginApi.ExtratermApi {
  setTopLevel(el: HTMLElement): void;
  addTab(el: HTMLElement): void;
  removeTab(el: HTMLElement): void;
}
