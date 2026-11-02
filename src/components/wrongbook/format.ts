export const wrongBookTypeLabels = { single: '单选题', multiple: '多选题', fill: '填空题', subjective: '主观题' };

export function wrongBookDate(raw: string | null) {
  if (!raw) return '时间未知';
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? '时间未知' : value.toLocaleString('zh-CN', { hour12: false });
}
