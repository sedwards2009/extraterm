/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { ExtensionContext, Terminal, TerminalBorderWidget } from '@extraterm/extraterm-extension-api';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { TemplateString, Segment } from './TemplateString';
import { TemplateEditorComponent } from "./TemplateEditorComponent";


export class EditTabTitleWidget {

  private _ui: EditTabTitlePanelUI = null;

  constructor(context: ExtensionContext, private _terminal: Terminal, private _widget: TerminalBorderWidget,
      private _templateString: TemplateString, updateFunc: () => void) {

    this._ui = new EditTabTitlePanelUI();

    const component = this._ui.$mount();
    this._widget.getContainerElement().appendChild(component.$el);
    this._widget.onDidOpen(() => {
      this._ui.originalTemplate = this._templateString.getTemplateString();
    });

    this._ui.template = this._templateString.getTemplateString();
    this._ui.segments = this._templateString.getSegments();
    this._ui.segmentHtml = this._templateString.getSegmentHtmlList();

    this._ui.$on("template-change", (template: string) => {
      this._templateString.setTemplateString(template);
      updateFunc();
      this._ui.segments = this._templateString.getSegments();
      this._ui.segmentHtml = this._templateString.getSegmentHtmlList();
    });
    this._ui.$on("close", () => {
      this._close();
    });
  }

  focus(): void {
    this._ui.focus();
  }

  private _close(): void {
    this._widget.close();
  }
}

@Component(
  {
    components: {
      "template-editor": TemplateEditorComponent,
    },
    template: trimBetweenTags(`
      <div class="gui-packed-row width-100pc">
        <label class="compact"><i class="fas fa-pen"></i></label>
        <div class="max-width-800px expand">
          <template-editor
            ref="template"
            v-bind:template="template"
            v-bind:segments="segments"
            v-bind:segmentHtml="segmentHtml"
            v-on:template-change="onTemplateChange"
            v-on:ok="onOk"
            v-on:close="onCancel"
          />
        </div>
        <div class="group compact">
          <button title="Accept" class="inline success char-width-2" v-on:click="onOk">
            <i class="fas fa-check"></i>
          </button>
          <button title="Cancel" class="inline danger char-width-2" v-on:click="onCancel">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>`)
  })
class EditTabTitlePanelUI extends Vue {
  template: string;
  originalTemplate: string;

  segments: Segment[];
  segmentHtml: string[];

  constructor() {
    super();
    this.template = "";
    this.originalTemplate = "";
    this.segments = [];
    this.segmentHtml = [];
  }

  onTemplateChange(template: string): void {
    this.template = template;
    this.$emit('template-change', template);
  }

  onOk(): void {
    this.$emit("close");
  }

  onCancel(): void {
    this.template = this.originalTemplate;
    this.$emit('template-change', this.template);
    this.$emit("close");
  }

  focus(): void {
    if (this.$refs.template != null) {
      (<HTMLInputElement> this.$refs.template).focus();
    }
  }
}
