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
<div class="form-horizontal">
  <div class="form-group">
    <label for="name" class="col-sm-4 control-label">Name:</label>
    <div class="input-group col-sm-8">
      <input type="text" class="form-control" name="name" v-model="name">
    </div>
  </div>

  <div class="form-group">
    <label class="col-sm-4 control-label">Executable:</label>
    <div class="input-group col-sm-8" v-bind:class="{'has-error': exeErrorMsg != ''}">
      <input type="text" class="form-control" list="exes" name="exe" v-model="exe">
      <div v-if="exeErrorMsg != ''" class="text-center"><i class="fas fa-exclamation-triangle"></i> {{ exeErrorMsg }}</div>
      <datalist id="exes">
        <option v-for="item in availableExes" :value="item"></option>
      </datalist>
    </div>
  </div>
</div>
`
})
export class WindowsConsoleSessionEditorUi extends Vue {
  name: string = "";
  exe: string = "";
  exeErrorMsg = "";
  availableExes: string[] = [];
}
