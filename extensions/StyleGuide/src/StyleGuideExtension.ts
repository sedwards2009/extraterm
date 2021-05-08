/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionContext, ExtensionTab, Logger } from '@extraterm/extraterm-extension-api';
import { escape } from "he";

let log: Logger = null;
let context: ExtensionContext = null;

export function activate(_context: ExtensionContext): any {
  log = _context.logger;
  context = _context;

  context.commands.registerCommand("styleguide:open", styleGuideCommand);
}

let styleGuideTab: ExtensionTab = null;

function styleGuideCommand(): void {
  if (styleGuideTab != null) {
    styleGuideTab.open();
    return;
  }

  styleGuideTab = context.window.createExtensionTab("styleguide");
  styleGuideTab.title = "Style Guide";
  styleGuideTab.icon = "fas fa-swatchbook";
  styleGuideTab.containerElement.innerHTML = contentsHTML();
  styleGuideTab.containerElement.addEventListener("click", handleClick);
  styleGuideTab.onClose(() => {
    styleGuideTab = null;
  });
  styleGuideTab.open();
}

function handleClick(ev: MouseEvent): void {
  ev.preventDefault();
  if ((<HTMLElement> ev.target).tagName === "A") {
    const href = (<HTMLAnchorElement> ev.target).href;
    context.application.openExternal(href);
  }
}

function contentsHTML(): string {
  return `<div id="guide">
  <h1>Style Guide</h1>

  <p>This guide demonstrates the built in styles and CSS classes for use by
  those developing extensions.</p>
  <p>Extraterm uses SASS at run time to complete CSS style sheets.</p>

  <h2>Variables</h2>
  <p>
  To use thse SASS variables, first import them into your stylesheet with:
  '@import "general-gui/variables";'
  </p>

  ${colorPatch([
    "text-color",
    "text-color-subtle",
    "text-minor-color",
    "text-highlight-color",
    "text-selected-color",
    "text-muted-color",
  ])}

  ${colorPatch([
    "background-highlight-color",
    "background-color",
    "background-selected-color",
  ])}

  ${colorPatch([
    "brand-primary",
    "brand-success",
    "brand-info",
    "brand-warning",
    "brand-danger",
  ])}

  ${colorPatch([
    "brand-text-primary",
    "brand-text-success",
    "brand-text-info",
    "brand-text-warning",
    "brand-text-danger"
  ])}

  <div class="code-example">
    <div class="code-example-result"><div class="panel-example"><div>Panel contents</div></div></div>
    <div class="code-example-source">The dashed outer box has
    "padding: $panel-body-padding;", separating it from the inner box..</div>
  </div>

  <h2>Text</h2>
  ${codeBlockVerbatum(`
  <h1>H1 Heading</h1>
  <h2>H2 Heading</h2>
  <h3>H3 Heading</h3>
  <h4>H4 Heading</h4>
  <h5>H5 Heading</h5>
  <h6>H6 Heading</h6>
  <p>
  Plain default text in a paragraph.
</p>
`)}

  <h2>Buttons</h2>

  ${codeBlock(`
  <button>Default button</button>
  <button class="success">Success button</button>
  <button class="info">Info button</button>
  <button class="warning">Warning button</button>
  <button class="danger">Danger button</button>
  `)}

  ${codeBlock(`
  <button disabled>Disabled default button</button>
  <button disabled class="success">Disabled success button</button>
  <button disabled class="info">Disabled info button</button>
  <button disabled class="warning">Disabled warning button</button>
  <button disabled class="danger">Disabled danger button</button>
  `)}

  ${codeBlock(`
  <button class="small">Small Default button</button>
  <button class="success small">Small Success button</button>
  <button class="info small">Small Info button</button>
  <button class="warning small">Small Warning button</button>
  <button class="danger small">Small Danger button</button>
  `)}

  ${codeBlock(`
  <button class="quiet">+</button>
  `)}

  ${codeBlock(`
  <button class="microtool">D</button><br />
  <button class="microtool primary">P</button><br />
  <button class="microtool success">S</button><br />
  <button class="microtool info">I</button><br />
  <button class="microtool warning">W</button><br />
  <button class="microtool danger">D</button><br />
  `)}

  ${codeBlock(`
  <button class="selected">Selected button</button><br />
  `)}

  <h2>Inputs</h2>
  ${codeBlock(`
  <label>Text input:</label><input type="text" placeholder="Placeholder" value="Some text input" />

  <label>Number input:</label><input type="number" value="5" min="0" max="100" />
  `)}

  ${codeBlock(`
  <label>Select:</label><select>
    <option selected value="1">One</option>
    <option value="2">Two</option>
  </select>
  `)}

  ${codeBlock(`
  <label><input type="checkbox"> Checkbox</label>
  <label><input type="checkbox" checked> Selected Checkbox</label>
  `)}

  ${codeBlock(`
  <label><input type="radio" name="radio"> Radio button</label>
  <label><input type="radio" name="radio" checked> Selected radio button</label>
  `)}

  <h2>Input validation states</h2>
  ${codeBlock(`
  <label>Success input:</label><input type="text" class="has-success" value="Some text input" />

  <label>Warning input:</label><input type="text" class="has-warning" value="Some text input" />

  <label>Error input:</label><input type="text" class="has-error" value="Some text input" />
  `)}

  <h2>Button groups</h2>
  ${codeBlock(`
  <span class="group"><button>Left</button><button>Right</button></span>

  <span class="group"><button class="success">Success</button><button class="warning">Warning</button><button class="danger">Danger</button></span>

  <span class="group"><button class="small">Left</button><button class="small">Right</button></span>
  `)}

  <h2>Input addons</h2>
  ${codeBlock(`
  <label>Amount:</label><span class="group"><input type="number" min="1" max="9999" ><span>euro</span></span><button class="inline">Inline button</button><br />

  <label>Amount:</label><span class="group"><span>$</span><input type="number" min="1" max="9999" ></span><br />

  <label>Amount:</label><span class="group"><span>$</span><input type="number" min="1" max="9999" ><span>.00</span></span>
  `)}

  <h2>Progress</h2>
  ${codeBlock(`
  Indeterminate: <progress class='inline-block'></progress>

  <progress class='inline-block' max='100' value='50'></progress>
  `)}

  <h2>GUI Layouts</h2>
  ${codeBlockVerbatum(`
  <div class="gui-layout cols-1-2 width-100pc">
    <label>First name:</label><input type="text" />
    <label>Last name:</label><input type="text" />

    <label>Gender:</label><div><input type="radio" name="gender" /> Man</div>
    <label></label><div><input type="radio" name="gender" /> Woman</div>
    <label></label><div><input type="radio" name="gender" /> Other</div>

    <label>Acceptable drinks:</label><div><input type="checkbox" checked /> Tea</div>
    <label></label><div><input type="checkbox" /> Coffee</div>
  </div>
  `)}
  <p>
  Two columns are supported and the relative columns widths are set using one
  of 'cols-1', 'cols-1-1', 'cols-1-2', and 'cols-1-3'.
  </p>

  <h2>GUI Packed Row</h2>
  <p>Neatly packs a bunch of inputs into one row.</p>
  ${codeBlock(`
  <div class="gui-packed-row width-100pc">
    <label class="compact">Enter long text:</label>
    <input type="text" class="expand" />
    <button class="small primary compact">Done</button>
    <label class="compact">trailing text</label>
  </div>
  `)}

  <h2>Width Classes</h2>
  <p>Element widths in percent and pixels.</p>
  <div class="code-example">
    <div class="code-example-result">
      width-100pc<br>
      width-800px<br>
      max-width-800px
    </div>
  </div>

  <p>Character based widths for use on INPUT elements.</p>
  <div class="code-example">
    <div class="code-example-result">
      char-width-2<br>
      char-width-3<br>
      char-width-4<br>
      char-width-6<br>
      char-width-8<br>
      char-width-12<br>
      char-width-20<br>
      char-width-30<br>
      char-width-40<br>
      char-width-60<br>
      char-width-80
    </div>
  </div>

  <p>Maximum character based widths for use on INPUT elements.</p>
  <div class="code-example">
    <div class="code-example-result">
      char-max-width-2<br>
      char-max-width-3<br>
      char-max-width-4<br>
      char-max-width-6<br>
      char-max-width-8<br>
      char-max-width-12<br>
      char-max-width-20<br>
      char-max-width-30<br>
      char-max-width-40<br>
      char-max-width-60<br>
      char-max-width-80
    </div>
  </div>

  <h2>Tables</h2>
  ${codeBlockVerbatum(`
  <table class="table-hover width-100pc">
    <thead>
      <tr>
        <th>Meaning</th>
        <th>Color</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Success</td>
        <td>Green</td>
      </tr>
      <tr>
        <td>Info</td>
        <td>Blue</td>
      </tr>
      <tr>
        <td>Warning</td>
        <td>Yellow</td>
      </tr>
    </tbody>
  </table>
  `)}

  <h1>Badges</h1>
  ${codeBlockVerbatum(`
  <h1>Heading <span class="badge">1</span></h1>
  <h2>Heading <span class="badge">2</span></h2>
  <h3>Heading <span class="badge">3</span></h3>

  <h1>Success Heading <span class="badge success">1</span></h1>
  <h2>Success Heading <span class="badge success">2</span></h2>
  <h3>Success Heading <span class="badge success">3</span></h3>

  <h1>Info Heading <span class="badge info">1</span></h1>
  <h2>Info Heading <span class="badge info">2</span></h2>
  <h3>Info Heading <span class="badge info">3</span></h3>

  <h1>Warning Heading <span class="badge warning">1</span></h1>
  <h2>Warning Heading <span class="badge warning">2</span></h2>
  <h3>Warning Heading <span class="badge warning">3</span></h3>

  <h1>Danger Heading <span class="badge danger">1</span></h1>
  <h2>Danger Heading <span class="badge danger">2</span></h2>
  <h3>Danger Heading <span class="badge danger">3</span></h3>
  `)}

  <h1>Keycaps</h1>
  ${codeBlock(`
  <span class="keycap">Ctrl+K</span>
  `)}

  <h2>Font Awesome Icons</h2>
  <p>
  The <a href="https://fontawesome.com/icons?d=gallery&p=2&m=free">free icons
  from Font Awesome 5</a> icons are available if "fontAwesome" is set to true
  in the CSS section of the package.json.
  </p>

  ${codeBlockVerbatum(`
  <h1><i class="fas fa-book"></i> icon in heading 1</h1>

  <h2><i class="fas fa-cog"></i> icon in heading 2</h2>

  <p><i class="fas fa-dice-d20"></i> plain icon in text.</p>
  `)}

</div>
`;
}

function codeBlockVerbatum(code: string): string {
  return `<div class="code-example">
    <div class="code-example-result">${code}</div>
    <div class="code-example-source">${crToBr(escape(code))}</div>
  </div>
`;
}

function codeBlock(code: string): string {
  return `<div class="code-example">
    <div class="code-example-result">${crToBr(code)}</div>
    <div class="code-example-source">${crToBr(escape(code))}</div>
  </div>
`;
}

function crToBr(s: string): string {
  return s.trim().replace(/\n/g,"<br>");
}


function colorPatch(names: string[]): string {
  return `<div class="code-example">
  <div class="code-example-result">
    ${names.map(color => `<div class="color-patch color-patch__${color}"></div> $${color}<br>`).join("")}
  </div></div>`;
}
