/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';


@Component(
  {
    template: `
<div>
  <h2><i class="fa fa-terminal"></i>&nbsp;&nbsp;Sessions</h2>
</div>
`
})
export class SessionSettingsUi extends Vue {

  constructor() {
    super();
  }
}
