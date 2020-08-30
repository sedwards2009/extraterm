/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { TemplateString, Segment } from './TemplateString';


@Component(
  {
    props: {
      template: String
    },
    template: trimBetweenTags(`
      <div class="width-100pc">
      Template: {{template}}
        <div class="gui-packed-row width-100pc">
          <div class="expand">
            <div class="gui-packed-row width-100pc">
              <input ref="template" type="text" class="char-max-width-40 expand"
                v-model="template"
                v-on:input="onTemplateChange"
                v-on:keydown.capture="onTemplateKeyDown"
                v-on:keypress.capture="onTemplateKeyPress"
                spellcheck="false"
                />
              <div class="group compact">
                <button class="inline" ref="insertField" v-on:click="onInsertField">Insert Field</button>
                <button class="inline" ref="insertIcon" v-on:click="onInsertIcon">Insert Icon</button>
              </div>
            </div>
            <div class="width-100pc">
              &nbsp;
              <template v-for="(segment, index) in segments">
                <span v-if="segment.type == 'text'" class="segment_text" v-on:click="selectSegment(index)" v-bind:title="segment.text">{{ segment.text }}</span>
                <span v-if="segment.type == 'field' && segment.error != null" class="segment_error" v-on:click="selectSegment(index)" v-bind:title="segment.text">{{ segment.error }}</span>
                <span v-if="segment.type == 'field' && segment.error == null" class="segment_field" v-on:click="selectSegment(index)" v-bind:title="segment.text"><span v-html="segmentHtml[index]"></span></span>
                <span v-if="segment.type == 'error'" class="segment_error" v-on:click="selectSegment(index)" v-bind:title="segment.text">{{ segment.error }}</span>
              </template>
            </div>
          </div>
        </div>

        <et-context-menu ref="insertFieldMenu">
          <div v-for="fieldTup in fieldList"
            class="insert_field_menu_item gui-packed-row"
            v-on:click="onInsertFieldClick(fieldTup[1])"><div class="expand">{{ fieldTup[0] }}</div><div>\${ {{fieldTup[1]}} }</div></div>
        </et-context-menu>

        <et-context-menu ref="insertIconMenu">
          <div class="insert_icon_grid">
            <div v-for="(icon, index) in iconList"
              class="insert_icon_menu_item"
              v-on:click="onInsertIconClick(icon)"><i v-bind:class="{ [icon]: true }"></i></div>
            </div>
        </et-context-menu>
      </div>`)
  })
export class TabTemplateEditorComponent extends Vue {
  template: string;
  originalTemplate: string;
  segments: Segment[];
  segmentHtml: string[];
  iconList: string[];
  fieldList: [string, string][];

  constructor() {
    super();
    this.template = "";
    this.originalTemplate = "";
    this.segments = [];
    this.segmentHtml = [];
    this.fieldList = [
      ["Title", "term:title"],
      ["Rows", "term:rows"],
      ["Columns", "term:columns"],
    ];
    this.iconList = [
      "fab fa-linux",
      "fab fa-windows",
      "fab fa-apple",
      "fab fa-android",
      "fab fa-ubuntu",
      "fab fa-fedora",
      "fab fa-redhat",
      "fab fa-suse",
      "fab fa-centos",
      "fab fa-freebsd",

      "fas fa-keyboard",
      "fas fa-terminal",
      "fab fa-docker",
      "fas fa-laptop",
      "fas fa-desktop",
      "fas fa-server",
      "fas fa-database",
      "fas fa-microchip",
      "fas fa-mobile-alt",
      "fas fa-tablet-alt",

      "fas fa-bug",
      "fas fa-code",
      "fab fa-git",
      "fas fa-code-branch",
      "fas fa-sitemap",
      "fas fa-cloud",
      "fas fa-upload",
      "fas fa-download",
      "far fa-comments",
      "far fa-envelope",

      "fas fa-home",
      "far fa-building",
      "fas fa-industry",
      "fas fa-city",
      "fas fa-robot",
      "fab fa-raspberry-pi",
      "fas fa-bolt",
      "fas fa-exclamation-triangle",
      "fas fa-shield-alt",
      "fab fa-usb",
    ];
  }

  onTemplateChange(): void {
    this.$emit('templateChange', this.template);
  }

  onInsertField(): void {
    (<any> this.$refs.insertFieldMenu).openAround(this.$refs.insertField);
  }

  onInsertFieldClick(fieldName: string): void {
    this.template = this.template + `\${${fieldName}}`;
    (<any> this.$refs.insertFieldMenu).close();
    this.$emit('templateChange', this.template);
  }

  onInsertIcon(): void {
    (<any> this.$refs.insertIconMenu).openAround(this.$refs.insertIcon);
  }

  onInsertIconClick(icon: string): void {
    this.template = this.template + `\${icon:${icon}}`;
    (<any> this.$refs.insertIconMenu).close();
    this.$emit('templateChange', this.template);
  }

  selectSegment(index: number): void {
    const segment = this.segments[index];
    (<HTMLInputElement> this.$refs.template).setSelectionRange(segment.startColumn, segment.endColumn);
    this.focus();
  }

  onOk(): void {
    this.$emit("close");
  }

  onCancel(): void {
    this.template = this.originalTemplate;
    this.$emit('templateChange', this.template);
    this.$emit("close");
  }

  onTemplateKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.onCancel();
    }
  }

  onTemplateKeyPress(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.onOk();
    }
  }

  focus(): void {
    if (this.$refs.template != null) {
      (<HTMLInputElement> this.$refs.template).focus();
    }
  }
}
