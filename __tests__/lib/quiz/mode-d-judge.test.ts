import { describe, expect, it } from 'vitest';
import { isModeDTapCorrect } from '@/lib/quiz/mode-d-judge';

describe('isModeDTapCorrect', () => {
  it('is correct only when the tapped code matches the question code', () => {
    expect(isModeDTapCorrect('01101', '01101')).toBe(true);
    expect(isModeDTapCorrect('01102', '01101')).toBe(false);
  });
});
