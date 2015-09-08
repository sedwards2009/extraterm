
import React = require('react');
import config = require('./config');
import _ = require('lodash');

type Config = config.Config;


interface CommandFramingPaneProps {
  patterns: string[];
  onChange: (newPatterns: string[]) => void;
}

class CommandFramingPane extends React.Component<CommandFramingPaneProps, any> {
  constructor(props: CommandFramingPaneProps) {
    super(props);
  }
  
  addClick(ev): void {
    const newList = [...this.props.patterns];
    newList.push("");
    this.props.onChange(newList);
  }
  
  itemChange(index: number, ev): void {
    const newList = [...this.props.patterns];
    newList[index] = ev.target.value;
    this.props.onChange(newList);    
  }
  
  deleteClick(index: number, ev): void {
    const newList = [...this.props.patterns];
    newList.splice(index, 1);
    this.props.onChange(newList);
  }
  
  render() {
    console.log("patterns:"+this.props.patterns);
    const patternList = this.props.patterns.map<JSX.Element>( (expr, index) =>   
      <div key={"item"+index}><input type='text' spellCheck={false} className='topcoat-text-input noframepattern' value={expr}
          onChange={ this.itemChange.bind(this, index) } />
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
};

interface State {
  config: Config;
  currentScrollbackLines: number;
}

export class SettingsPane extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    const config = this.props.config;
    const scrollbackLines = config === null ? 1000 : config.scrollbackLines;
    this.state = {
      config: config,
      currentScrollbackLines: scrollbackLines
    };
  }
  
  changeState( updateFunc: (newState: State) => void): void {
    const newState = _.cloneDeep(this.state);
    updateFunc(newState);
    this.setState(newState);
  }
  
  set config(config: Config) {
    this.changeState( (newState) => {
      newState.config = config;
    });
  }
  
  scrollbackLinesChange(ev): void {
    this.changeState( (newState) => {
      newState.currentScrollbackLines = parseInt(ev.target.value, 10);
    });
  }

  scrollbackLinesBlur(ev): void {
    const newScrollbackLines = parseInt(ev.target.value, 10);

    if (newScrollbackLines < this.state.config.scrollbackLines) {
      if ( ! window.confirm("Making the scrollback smaller will delete existing lines.")) {
        this.changeState( (newState) => {
          newState.currentScrollbackLines =
            newState.config.scrollbackLines===undefined ? 1000 : newState.config.scrollbackLines;
        });
        return;
      }
    }
    const newState = _.cloneDeep(this.state);
    newState.config.scrollbackLines = newScrollbackLines;
    this.setState(newState);
  }
  
  blinkingCursorChange(ev): void {
    this.changeState( (newState) => {
      newState.config.blinkingCursor = ev.target.checked;
    });
  }
  
  noFrameCommandsChange(patterns: string[]): void {
    this.changeState( (newState) => {
      newState.config.noFrameCommands = patterns;
    });
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
              onChange={this.scrollbackLinesChange.bind(this)}  onBlur={this.scrollbackLinesBlur.bind(this)} />lines</div>
            
            <div>Theme:</div>
            <div>X</div>
          </div>
          <CommandFramingPane patterns={this.state.config.noFrameCommands} onChange={this.noFrameCommandsChange.bind(this)} />
        </div>
      );
    }
  }
}
