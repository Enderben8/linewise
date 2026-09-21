export type LineKind = 'text' | 'speaker' | 'dialogue' | 'action';
export type BodyType = 'text' | 'script';

export interface Line {
  kind: LineKind;
  text: string;
  speaker?: string;
}

export interface Chunk {
  index: number;
  lines: Line[];
}

/** norm = lowercase, no punctuation. start/end index into the source string. */
export interface Token {
  text: string;
  norm: string;
  start: number;
  end: number;
}

export type AlignOp = 'match' | 'missed' | 'extra' | 'wrong';

export interface AlignItem {
  op: AlignOp;
  target?: Token;
  attempt?: Token;
}

export type ScriptIssueCode = 'SPEAKER_NO_DIALOGUE' | 'LOOKS_LIKE_SPEAKER';

export interface ScriptIssue {
  line: number; // 1-based line number in the body
  code: ScriptIssueCode;
}
