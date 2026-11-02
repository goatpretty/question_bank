export function getOptionLabel(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

const KNOWN_NON_OPTION_COLUMNS = [
  '序号', '题型', '题干', '答案', '解析', '课程', '章节', '标签',
  'questionType', 'stem', 'answer', 'analysis', 'course', 'chapter', 'tags',
  'type', 'content',
];

const OPTION_COLUMN_REGEX = /^[A-Z]{1,2}$/;

export function extractOptionColumns(
  header: string[],
  answerColName: string = '答案'
): string[] {
  const answerIdx = header.findIndex(h => h === answerColName);

  const optionCols: { col: string; index: number }[] = [];

  for (let i = 0; i < header.length; i++) {
    const h = header[i].trim();
    if (KNOWN_NON_OPTION_COLUMNS.includes(h)) continue;
    if (!OPTION_COLUMN_REGEX.test(h)) continue;
    if (answerIdx !== -1 && i > answerIdx) continue;
    optionCols.push({ col: h, index: i });
  }

  optionCols.sort((a, b) => a.index - b.index);
  return optionCols.map(o => o.col);
}

export function extractOptionValues(
  row: any[],
  optionCols: string[],
  header: string[]
): { id: string; content: string }[] {
  const options: { id: string; content: string }[] = [];
  for (const col of optionCols) {
    const idx = header.indexOf(col);
    if (idx === -1) continue;
    const val = String(row[idx] || '').trim();
    if (val) {
      options.push({ id: col, content: val });
    }
  }
  return options;
}
