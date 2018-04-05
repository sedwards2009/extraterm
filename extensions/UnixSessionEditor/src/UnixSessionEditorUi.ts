/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

@Component(
  {
    template: `
    <div id="top_container">
      Name: <input type="text" v-model.lazy="name"><br />
      Shell: <input type="text" v-model.lazy="shell">
    </div>`
})
export class UnixSessionEditorUi extends Vue {
  name: string = "";
  shell: string = "";
}
