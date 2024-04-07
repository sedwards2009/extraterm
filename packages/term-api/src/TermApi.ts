import { QImage } from "@nodegui/nodegui";
import { Event } from "extraterm-event-emitter";
import { TextEmulatorApi, Line } from "./TextTermApi";
export { CharAttr, Line, Layer, TerminalCoord, TerminalSize, ScreenChangeEvent,
  RenderEvent, BellEvent, DataEvent, TitleChangeEvent, WriteBufferSizeEvent,
  MouseEventOptions, WriteBufferStatus, ApplicationModeHandler, ApplicationModeResponseAction,
  ApplicationModeResponse, MinimalKeyboardEvent, TextEmulatorApi,
  flagsFromCharAttr, foregroundFromCharAttr, backgroundFromCharAttr, packAttr,
  BOLD_ATTR_FLAG, UNDERLINE_ATTR_FLAG, BLINK_ATTR_FLAG, INVERSE_ATTR_FLAG,
  INVISIBLE_ATTR_FLAG, ITALIC_ATTR_FLAG, STRIKE_THROUGH_ATTR_FLAG, FAINT_ATTR_FLAG,
} from "./TextTermApi";

export interface ImageAddedEvent {
  id: number;
  image: QImage;
  line: Line;
}

export interface EmulatorApi extends TextEmulatorApi {
  onImageAdded: Event<ImageAddedEvent>;
}
