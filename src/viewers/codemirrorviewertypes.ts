
export interface TextDecoration {
  line: number;
  fromCh: number;
  toCh: number;
  classList: string[];
}

export interface CursorMoveDetail {
  left: number;
  top: number;
  bottom: number;
  viewPortTop: number;
}
