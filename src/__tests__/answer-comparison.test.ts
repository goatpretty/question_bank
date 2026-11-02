import { describe, expect, it } from '@jest/globals';
import { isAnswerCorrect } from '../../shared/answer';

describe('answer comparison', () => {
  it('compares single choice answers case-insensitively', () => {
    expect(isAnswerCorrect('single', 'A', 'A')).toBe(true);
    expect(isAnswerCorrect('single', 'A', 'a')).toBe(true);
    expect(isAnswerCorrect('single', 'A', ' A ')).toBe(true);
    expect(isAnswerCorrect('single', 'A', 'B')).toBe(false);
  });

  it('compares multiple choice answers regardless of order, case and duplicates', () => {
    expect(isAnswerCorrect('multiple', ['A', 'B'], ['A', 'B'])).toBe(true);
    expect(isAnswerCorrect('multiple', ['A', 'B'], ['B', 'A'])).toBe(true);
    expect(isAnswerCorrect('multiple', ['A', 'B'], ['a', 'b'])).toBe(true);
    expect(isAnswerCorrect('multiple', ['A', 'B'], [' A ', ' B '])).toBe(true);
    expect(isAnswerCorrect('multiple', ['A', 'B'], ['A', 'A', 'B'])).toBe(true);
    expect(isAnswerCorrect('multiple', 'A,B', ['B', 'A'])).toBe(true);
    expect(isAnswerCorrect('multiple', ['A', 'B'], ['A', 'C'])).toBe(false);
    expect(isAnswerCorrect('multiple', ['A', 'B'], ['A'])).toBe(false);
  });

  it('compares fill answers case-insensitively', () => {
    expect(isAnswerCorrect('fill', '社会主义', '社会主义')).toBe(true);
    expect(isAnswerCorrect('fill', 'Socialism', ' socialism ')).toBe(true);
    expect(isAnswerCorrect('fill', 'Socialism', 'Capitalism')).toBe(false);
  });
});
