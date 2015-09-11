/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

import React = require('react');
import icepick = require('icepick');
import config = require('./config');

type Config = config.Config;

interface CommandFramingPaneProps {
  patterns: string[];
  onChange: (newPatterns: string[]) => void;
  onIntermediateChange: (newPatterns: string[]) => void;
}

class CommandFramingPane extends React.Component<CommandFramingPaneProps, any> {
  constructor(props: CommandFramingPaneProps) {
    super(props);
  }
  
  addClick(ev): void {
    this.props.onChange(icepick.push(this.props.patterns, ""));
  }
  
  itemChange(index: number, ev): void {
    this.props.onIntermediateChange(icepick.assoc(this.props.patterns, index, ev.target.value));
  }
  
  deleteClick(index: number, ev): void {
    this.props.onChange(icepick.splice(this.props.patterns, index, 1));
  }
  
  onBlur(ev: FocusEvent): void {
    this.props.onChange(this.props.patterns);
  }
  
  render() {
    const patternList = this.props.patterns.map<JSX.Element>( (expr, index) =>   
      <div className="patternline" key={"item"+index}><input type='text' spellCheck={false}
          className='topcoat-text-input' value={expr}
          onChange={ this.itemChange.bind(this, index) }
          onBlur={ this.onBlur.bind(this) } />
          <button onClick={ this.deleteClick.bind(this, index) } title="Delete"><i className="fa fa-trash-o"></i></button></div>
    );
    
    patternList.push( <button key={"new"} onClick={this.addClick.bind(this)} title="Add new"><i className="fa fa-plus"></i>Add new</button> );
    
    return <div><h1 className='gui-heading'>Suppress Output Framing</h1>
      Commands which match these regular expressions will not have their output framed.
      <div className='noframepatterns'>
        { patternList }
      </div>
    </div>;
  }  
}

//-------------------------------------------------------------------------------------------------------------
interface Props {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
}

interface State {
  config?: Config;
  previousConfig?: Config;
  currentScrollbackLines?: number;
}
// These here above are semi-optional because setState() takes a partial State object even
// though we generally want every property in a full State object to be set to something.

export class SettingsPane extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    const config = this.props.config;
    const scrollbackLines = config === null ? 1000 : config.scrollbackLines;
    this.state = {
      config: config,
      previousConfig: config,
      currentScrollbackLines: scrollbackLines
    };
  }

  private assocConfig(dottedName: string, value: any, broadcast: boolean = true): void {
    let newConfig: Config;
    if (dottedName.indexOf('.') !== -1) {
      newConfig = icepick.assocIn(this.state.config, dottedName.split(/\./g), value);
      
    } else {
      newConfig = icepick.assoc(this.state.config, dottedName, value);
    }
    const previousConfig = this.state.previousConfig;
    this.setState({config: newConfig});
    if (broadcast && ! Object.is(this.state.previousConfig, newConfig)) {
      this.props.onConfigChange(this.state.config);
      this.setState({ previousConfig: newConfig});
    }
  }
  
  private broadcastConfig(): void {
    if (Object.is(this.state.config, this.state.previousConfig)) {
      return;
    }

    this.props.onConfigChange(this.state.config);
    this.setState({ previousConfig: this.state.config});
  }
    
  set config(config: Config) {
    this.setState( { config: config } );
  }
  
  private scrollbackLinesChange(ev): void {
    this.setState( { currentScrollbackLines: parseInt(ev.target.value, 10) } );
  }

  private scrollbackLinesBlur(ev): void {
    const newScrollbackLines = parseInt(ev.target.value, 10);

    if (newScrollbackLines < this.state.config.scrollbackLines) {
      if ( ! window.confirm("Making the scrollback smaller will delete existing lines.")) {
        this.setState( { currentScrollbackLines:
          this.state.config.scrollbackLines===undefined ? 1000 : this.state.config.scrollbackLines } );
        return;
      }
    }
    
    this.assocConfig("scrollbackLines", newScrollbackLines);
  }
  
  private blinkingCursorChange(ev): void {
    this.assocConfig("blinkingCursor", ev.target.checked);
  }
  
  private noFrameCommandsChange(intermediate: boolean, patterns: string[]): void {
    this.assocConfig("noFrameCommands", patterns, !intermediate);
  }
  
  render() {
    if (this.state.config === null) {
      return <div></div>;
    } else {
      const scrollLines = this.state.config.scrollbackLines===undefined ? 1000 : this.state.config.scrollbackLines;
      const blinkingCursor = this.state.config.blinkingCursor === undefined ? false : this.state.config.blinkingCursor;
      return (
        <div className='settingspane'>
          <h1 className='gui-heading'>Settings</h1>
          <div className='settingsform'>
            <div></div>
            <div>
              <label className='topcoat-checkbox flex2'>
                <input type='checkbox' checked={this.state.config.blinkingCursor}
                  onChange={this.blinkingCursorChange.bind(this)} />
                <div className='topcoat-checkbox__checkmark'></div>Blinking cursor  
              </label>
            </div>
          
            <div>Scrollback:</div>
            <div><input type='number' value={""+this.state.currentScrollbackLines} min='1' max='10000'
              onChange={this.scrollbackLinesChange.bind(this)}
              onBlur={this.scrollbackLinesBlur.bind(this)} />lines</div>

            <div>Theme:</div>
            <div>X</div>
          </div>
          <CommandFramingPane patterns={this.state.config.noFrameCommands}
            onChange={this.noFrameCommandsChange.bind(this, false)}
            onIntermediateChange={this.noFrameCommandsChange.bind(this, true)}/>
        </div>
      );
    }
  }
}
