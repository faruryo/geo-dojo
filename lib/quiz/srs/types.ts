export type ReviewQuality = 2 | 4;

export type SrsStatus = 'reviewing' | 'graduated';

export interface SrsState {
  easeFactor: number;
  repetition: number;
  interval: number;
  status: SrsStatus;
}

export interface SrsUpdateResult extends SrsState {
  dueInDays: number;
  graduated: boolean;
}
