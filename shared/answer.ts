export type AnswerType = 'single' | 'multiple' | 'fill' | 'subjective';
export type AnswerValue = string | string[];

function normalizeChoice(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * 判定选择题/填空题答案是否正确。
 * - 多选忽略顺序、大小写、首尾空白和重复项；
 * - 填空忽略大小写和首尾空白；
 * - 单选只比较第一个答案值。
 */
export function isAnswerCorrect(
  type: AnswerType,
  correctAnswer: AnswerValue,
  userAnswer: AnswerValue,
): boolean {
  if (type === 'multiple') {
    const normalizeList = (answer: AnswerValue) => {
      const values = Array.isArray(answer) ? answer : answer.split(',');
      return [...new Set(values.map(normalizeChoice).filter(Boolean))].sort();
    };
    return JSON.stringify(normalizeList(correctAnswer)) === JSON.stringify(normalizeList(userAnswer));
  }

  if (type === 'fill') {
    return String(correctAnswer).trim().toLowerCase() === String(userAnswer).trim().toLowerCase();
  }

  const first = (answer: AnswerValue) => Array.isArray(answer) ? answer[0] ?? '' : answer;
  return normalizeChoice(first(correctAnswer)) === normalizeChoice(first(userAnswer));
}
