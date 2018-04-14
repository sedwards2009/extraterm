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
      Python path: <input type="text" v-model.lazy="pythonExe"><br />
      <input type="radio" value="1" v-model.number="useDefaultShell"> Use default shell<br />
      <input type="radio" value="0" v-model.number="useDefaultShell"> Shell: <input type="text" :disabled="useDefaultShell===1" v-model.lazy="shell">
    </div>`
})
export class ProxySessionEditorUi extends Vue {
  name: string = "";
  shell: string = "";
  useDefaultShell: number = 1;
  pythonExe = "";
}
