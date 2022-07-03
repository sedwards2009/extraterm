/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import he from "he";


export interface TextSegment {
  type: "text";
  text: string;

  startColumn: number;
  endColumn: number;
}

export interface FieldSegment {
  type: "field";
  namespace: string;
  key: string;
  text: string;
  error: string;
  startColumn: number;
  endColumn: number;
}

export interface ErrorSegment {
  type: "error";
  text: string;
  error: string;

  startColumn: number;
  endColumn: number;
}

export type Segment = TextSegment | FieldSegment | ErrorSegment;

export interface FormatResult {
  text?: string;
  html?: string;
  iconName?: string;
}

export interface FieldFormatter {
  format(key: string): FormatResult;
  getErrorMessage(key: string): string;
}

export class TemplateString {

  #template: string = null;
  #segments: Segment[] = null;
  #formatterMap = new Map<string, FieldFormatter>();

  getTemplateString(): string {
    return this.#template;
  }

  setTemplateString(template: string): void {
    this.#template = template;
    this.#segments = this.#parse(template);
  }

  addFormatter(namespace: string, formatter: FieldFormatter): void {
    this.#formatterMap.set(namespace.toLowerCase(), formatter);
  }

  getSegments(): Segment[] {
    return this.#segments;
  }

  #tokenIndex = 0;
  #tokens: Token[];

  #parse(template: string): Segment[] {
    this.#tokens = lex(template);
    this.#tokenIndex = 0;

    let result: Segment[] = [];
    while (this.#peekTokenType() !== TokenType.EOF) {
      result = [...result, ...this.#processTextStateTokens()];
      result = [...result, ...this.#processFieldStateTokens()];
    }

    this.#correctColumns(result);
    this.#detectErrors(result);

    return result;
  }

  #peekTokenType(): TokenType {
    return this.#tokens.length === this.#tokenIndex ? TokenType.EOF : this.#tokens[this.#tokenIndex].type;
  }

  #takeToken(): Token {
    this.#tokenIndex++;
    return this.#tokens[this.#tokenIndex-1];
  }

  #processTextStateTokens(): Segment[] {
    const textTokens = [TokenType.STRING, TokenType.ESCAPE_DOLLAR];

    const textSegment: TextSegment = { text: "", type: "text", startColumn: 0, endColumn: 0 };

    while (textTokens.indexOf(this.#peekTokenType()) !== -1) {
      const token = this.#takeToken();
      if (token.type === TokenType.STRING) {
        textSegment.text += token.text;
        textSegment.endColumn += token.text.length;
      } else if (token.type === TokenType.ESCAPE_DOLLAR) {
        textSegment.text += "$";
        textSegment.endColumn += 2;
      }
    }

    return textSegment.text.length !== 0 ? [textSegment] : [];
  }

  #processFieldStateTokens(): Segment[] {
    if (this.#peekTokenType() === TokenType.EOF) {
      return [];
    }

    if (this.#checkFieldTokens()) {
      return [this.#processCompleteField()];
    } else {
      return [this.#processBadField()];
    }
  }

  #checkFieldTokens(): boolean {
    const fieldTokenTypeList = [
      TokenType.OPEN_BRACKET,
      TokenType.SYMBOL,
      TokenType.COLON,
      TokenType.SYMBOL,
      TokenType.CLOSE_BRACKET
    ];

    const startIndex = this.#tokenIndex;
    let pass = true;
    for (const type of fieldTokenTypeList) {
      if (this.#peekTokenType() !== type) {
        pass = false;
        break;
      }
      this.#takeToken();
    }
    this.#tokenIndex = startIndex;
    return pass;
  }

  #processCompleteField(): Segment {
    this.#takeToken();                        // TokenType.OPEN_BRACKET
    const namespace = this.#takeToken().text; // TokenType.SYMBOL
    this.#takeToken();                        // TokenType.COLON
    const key = this.#takeToken().text;       // TokenType.SYMBOL
    this.#takeToken();                        // TokenType.CLOSE_BRACKET
    const fieldSegment: FieldSegment = {
      type: "field",
      namespace: namespace,
      key: key,
      text: "${" + namespace + ":" + key + "}",
      error: null,
      startColumn: 0,
      endColumn: 2 + namespace.length + 1 + key.length + 1
    };
    return fieldSegment;
  }

  #processBadField(): Segment {
    const nonFieldTypes = [TokenType.STRING, TokenType.ESCAPE_DOLLAR, TokenType.EOF];

    let badInput = "";
    while (nonFieldTypes.indexOf(this.#peekTokenType()) === -1) {
      const token = this.#takeToken();
      badInput += token.text;
    }
    const errorSegment: ErrorSegment = {
      type: "error",
      text: badInput,
      startColumn: 0,
      endColumn: badInput.length,
      error: `Badly formatted field '${badInput}'`
    };
    return errorSegment;
  }

  #correctColumns(segments: Segment[]): void {
    let i = 0;
    for (const segment of segments) {
      segment.startColumn = i;
      i += segment.endColumn;
      segment.endColumn = i;
    }
  }

  #detectErrors(segments: Segment[]): void {
    for (const segment of segments) {
      if (segment.type === "field") {
        const namespace = segment.namespace.toLowerCase();
        const formatter = this.#formatterMap.get(namespace);
        if (formatter == null) {
          segment.error = `Unknown field '${segment.namespace}:${segment.key}'`;
        } else {
          const errorMsg = formatter.getErrorMessage(segment.key);
          segment.error = errorMsg;
        }
      }
    }
  }

  getSegmentHtmlList(): string[] {
    return this.#segments.map(segment => {
      const result = this.formatSegment(segment);
      return result.html != null ? result.html : (he.encode(result.text) ?? "");
    });
  }

  formatHtml(): string {
    return this.getSegmentHtmlList().join("");
  }

  getSegmentTextList(): string[] {
    return this.#segments.map(segment => {
      return this.formatSegment(segment).text;
    });
  }

  formatText(): string {
    return this.#segments.map(segment => this.formatSegment(segment).text).join("");
  }

  formatSegment(segment: Segment): FormatResult {
    switch (segment.type) {
      case "text":
        return { text: segment.text };
      case "field":
        const namespace = segment.namespace.toLowerCase();
        const formatter = this.#formatterMap.get(namespace);
        if (formatter == null) {
          return { text: "" };
        }
        return formatter.format(segment.key);
      case "error":
        return { text: "" };
    }
  }
}


enum LexerState {
  NORMAL = "NORMAL",
  FIELD = "FIELD",
}

enum TokenType {
  STRING,
  ESCAPE_DOLLAR,
  OPEN_BRACKET,
  SYMBOL,
  COLON,
  CLOSE_BRACKET,
  EOF
}

interface Token {
  type: TokenType;
  text: string;
}

interface LexMatcher {
  match: RegExp;
  type: TokenType;
  newState: LexerState;
}

const NormalParseRules: LexMatcher[] = [
  { match: new RegExp("^[$][{]"), type: TokenType.OPEN_BRACKET, newState: LexerState.FIELD },
  { match: new RegExp("^[\\\\][$]"), type: TokenType.ESCAPE_DOLLAR, newState: LexerState.NORMAL },
  { match: new RegExp("^[^$\\\\]+"), type: TokenType.STRING, newState: LexerState.NORMAL },
  { match: new RegExp("^[$]"), type: TokenType.STRING, newState: LexerState.NORMAL },
  { match: new RegExp("^[\\\\]"), type: TokenType.STRING, newState: LexerState.NORMAL },
];

const FieldParseRules: LexMatcher[] = [
  { match: new RegExp("^[^:}]+"), type:TokenType.SYMBOL, newState: LexerState.FIELD },
  { match: new RegExp("^:"), type: TokenType.COLON, newState: LexerState.FIELD },
  { match: new RegExp("^}"), type: TokenType.CLOSE_BRACKET, newState: LexerState.NORMAL }
];

const LexerStateRules: { [key: string]: LexMatcher[]; } = {
  [LexerState.NORMAL]: NormalParseRules,
  [LexerState.FIELD]: FieldParseRules,
};

function lex(input: string): Token[] {
  const result: Token[] = [];
  let currentInput = input;
  let state = LexerState.NORMAL;

  while (currentInput.length !== 0) {
    let didMatch = false;
    for (const rule of LexerStateRules[state]) {
      const matchResult = currentInput.match(rule.match);
      if (matchResult != null) {
        result.push( { type: rule.type, text: matchResult[0] } );
        currentInput = currentInput.slice(matchResult[0].length);
        state = rule.newState;
        didMatch = true;
        break;
      }
    }
    if ( ! didMatch) {
      throw "Unable to parse!";
    }
  }

  return result;
}
