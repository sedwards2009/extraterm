/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import im = require('immutable');
import domutils = require('./domutils');
import resourceLoader = require('./resourceloader');
import globalcss = require('./gui/globalcss');

const ID = "EtAboutDialog";
const ID_DIALOG = "dialog";

let registered = false;

class EtAboutDialog extends HTMLElement {
  
  static TAG_NAME: string = 'et-about-dialog';
  
  static init(): void {
    if (registered === false) {
      globalcss.init();
      window.document.registerElement(this.TAG_NAME, {prototype: EtAboutDialog.prototype});
      registered = true;
    }
  }
  
  // WARNING: Fields like this will not be initialised automatically.
  
  private _css() {
    return `${globalcss.topcoatCSS()}

      @import url('${resourceLoader.toUrl("css/flexlayout.css")}');
      #dialog {
          position: fixed;
          background-color: #F4F4F4;
          border: 0px;
          border-radius: 4px;
          padding: 8px;
          min-width: 30em;
      }
      DIV.about_panel {
          display: flex;
          flex-direction: column;
      }`;
  }

  private _html(): string {
    return `<dialog id='${ID_DIALOG}'>
          <div id='about_panel' class='about_panel gui'>
              <div class='about_content flexmin'>
                  <h1 class='gui-heading'>Extraterm</h1>
                  <p>Copyright 2015 Simon Edwards &lt;simon@simonzone.com&gt;</p>
                  <div class='flexhlayout'><!-- horizonal center the lot. -->
                      <div class='flexmax'></div>
                      
                      <div class='flexmax'></div>
                  </div>
                  <div class='vspace'></div>
                  <div class='flexhlayout'>
                      <div class="flexmax"></div>
                      <button id='ok_button' class='flexmin topcoat-button--large--cta'>OK</button>
                      <div class="flexmax"></div>
                  </div>
              </div>
          </div>
      </dialog>`;
  }
  
  createdCallback(): void {
    const shadow = domutils.createShadowRoot(this);
    const clone = this._createClone();
    shadow.appendChild(clone);
    
    const okButton = this._getById("ok_button");
    okButton.addEventListener("click",  () => {
      this._handleOk();
    });
  }
  
  private _createClone(): Node {
    let template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _getById(id: string): HTMLElement {
    return <HTMLElement>domutils.getShadowRoot(this).querySelector('#'+id);
  }

  /**
   * Handler for OK button clicks.
   */
  private _handleOk(): void {
    this.close();
    
    // var event = new CustomEvent('ok');
    // event.initCustomEvent('ok', true, true, this._guiToConfig());
    // this.dispatchEvent(event);
  }
  
  open(): void {
    const dialog = <HTMLDialogElement> this._getById(ID_DIALOG);
    dialog.showModal();
  }
  
  close(): void {
    const dialog = <HTMLDialogElement> this._getById(ID_DIALOG);
    dialog.close();
  }  
}

export = EtAboutDialog;
