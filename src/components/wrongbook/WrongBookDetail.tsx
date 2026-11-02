import { useEffect, useRef, useState } from 'react';
import QuestionBrowser from '../QuestionBrowser';
import QuestionSnapshot from './QuestionSnapshot';
import { wrongBookDate, wrongBookTypeLabels } from './format';
import Pagination, { wrongBookButton } from './Pagination';
import { wrongBookService } from '../../services/wrongBookService';
import type { WrongBookAnswer, WrongBookDetailData, WrongBookItemView, WrongBookQuestionSnapshot } from '../../../shared/wrongbook';

function wrongAnswerLetters(answer: WrongBookAnswer, question: WrongBookQuestionSnapshot) {
  const values = (Array.isArray(answer) ? answer : [answer]).filter(value => value.trim());
  if (!values.length) return '未作答';
  if (question.type !== 'single' && question.type !== 'multiple') return values.join('、');
  const options = values.map(value => question.options.find(option => option.id === value));
  if (options.some(option => !option)) return '历史选项已变更，无法对应当前选项';
  return [...new Set(options.map(option => option?.displayLabel || ''))].sort().join('、');
}

export default function WrongBookDetail({ items, selectedId, onSelect, onClose, onMasteryChange }: {
  items: WrongBookItemView[];
  selectedId: string;
  onSelect: (questionId: string) => void;
  onClose: () => void;
  onMasteryChange: (item: WrongBookItemView) => void;
}) {
  const [data, setData] = useState<WrongBookDetailData | null>(null);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const owner = useRef(selectedId);
  owner.current = selectedId;
  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++generation.current;
    setLoading(true); setError('');
    wrongBookService.getDetail(selectedId, page, 5, controller.signal).then(response => {
      if (sequence === generation.current && !controller.signal.aborted) setData(response.data);
    }).catch(reason => {
      if (!controller.signal.aborted && sequence === generation.current) setError(reason instanceof Error ? reason.message : '错题详情加载失败。');
    }).finally(() => { if (!controller.signal.aborted && sequence === generation.current) setLoading(false); });
    return () => { controller.abort(); };
  }, [selectedId, page, version]);

  const item = data?.item.questionId === selectedId ? data.item : items.find(row => row.questionId === selectedId);
  const changeMastery = async () => {
    if (!item || busy) return;
    const id = selectedId;
    setBusy(true); setNotice('');
    try {
      const response = await wrongBookService.markMastered(id, !item.isMastered);
      onMasteryChange(response.data);
      if (owner.current !== id) return;
      setData(previous => previous?.item.questionId === id ? { ...previous, item: response.data } : previous);
      setNotice(response.data.isMastered ? '已标记为已掌握。' : '已恢复为未掌握。');
    } catch (reason) { if (owner.current === id) setNotice(`操作失败：${reason instanceof Error ? reason.message : '请重试。'}`); }
    finally { setBusy(false); }
  };

  return <QuestionBrowser actions={<button className={wrongBookButton} disabled={busy || loading || !!error || !item} type="button" onClick={changeMastery}>{busy ? '保存中…' : item?.isMastered ? '恢复未掌握' : '标记已掌握'}</button>} closeLabel="返回错题列表" items={items.map(row => ({ id: row.questionId, status: (row.questionId === selectedId && item ? item.isMastered : row.isMastered) ? 'correct' : 'incorrect' }))}
    legend={<p className="mb-3 text-xs leading-relaxed text-gray-500">绿色：已掌握 · 红色：待复习<br />显示当前列表页的题目</p>}
    selectedIndex={Math.max(0, items.findIndex(row => row.questionId === selectedId))}
    subtitle={`${item?.question.subjectName || ''}${item?.question.chapterName ? ` / ${item.question.chapterName}` : ''}`}
    title="错题详情" onClose={onClose}
    onSelect={index => {
      setPage(1); setNotice('');
      const questionId = items[index].questionId;
      if (questionId === selectedId) return;
      setData(null); setError(''); onSelect(questionId);
    }}>
    {notice && <p className={`mb-4 rounded-lg border p-3 text-sm ${notice.startsWith('操作失败') ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`} role={notice.startsWith('操作失败') ? 'alert' : 'status'}>{notice}</p>}
    {loading ? <p className="py-12 text-center text-gray-500" role="status">正在加载错题详情…</p> : error ? <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800" role="alert">
      <p>{error}</p><button className={`${wrongBookButton} mt-3`} type="button" onClick={() => setVersion(value => value + 1)}>重试详情</button>
    </div> : data && <div className="space-y-6">
      <section aria-label="当前题目" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{wrongBookTypeLabels[data.item.question.type]}</span>
          <span className="text-red-600 dark:text-red-300">累计错误 {data.item.wrongCount} 次</span>
          <span className="text-gray-500">最近错误：{wrongBookDate(data.item.lastWrongAt)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">当前题目与答案</h3>
          <span className={data.item.isMastered ? 'text-sm text-green-700 dark:text-green-300' : 'text-sm text-red-600 dark:text-red-300'}>{data.item.isMastered ? '已掌握' : '未掌握'}</span>
        </div>
        <QuestionSnapshot question={data.item.question} />
      </section>
      <section aria-label="历次错误记录">
        <div className="mb-4 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">历次错误记录</h3>
          <p className="mt-1 text-sm text-gray-500">按提交时间从新到旧 · 共 {data.total} 次记录</p>
        </div>
        <p className="mb-3 text-xs text-gray-500">错选答案对应上方完整选项的字母。</p>
        {!!data.legacyOccurrenceCount && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">另有 {data.legacyOccurrenceCount} 次旧错误只有汇总次数，缺少当次答案和来源，无法完整还原。</p>}
        {!data.total && <p className="rounded-lg bg-gray-50 p-5 text-sm text-gray-500 dark:bg-gray-900/30">暂无可追溯的错误明细，当前题目仍可用于复习。</p>}
        {data.occurrences.some(occurrence => occurrence.snapshotStatus === 'reconstructed') && <p className="mb-3 text-xs leading-relaxed text-gray-500">历史快照缺失：本页部分记录没有完整题目快照，答案根据留存的选项标识对应上方选项。</p>}
        {data.total > 0 && <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table aria-label="历次错选答案" className="w-full table-fixed text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-900/40 dark:text-gray-300"><tr><th className="w-[38%] px-3 py-3 font-medium" scope="col">错误时间</th><th className="px-3 py-3 font-medium" scope="col">错选答案</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{data.occurrences.map(occurrence => <tr key={occurrence.id}>
              <td className="align-top px-3 py-4 text-gray-500"><time dateTime={occurrence.submittedAt}>{wrongBookDate(occurrence.submittedAt)}</time></td>
              <td className="align-top break-words px-3 py-4 font-medium text-red-700 dark:text-red-300">{wrongAnswerLetters(occurrence.userAnswer, data.item.question)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {data.total > 0 && <Pagination label="错误记录分页" limit={5} page={page} total={data.total} onChange={next => { setPage(next); setNotice(''); }} />}
      </section>
    </div>}
  </QuestionBrowser>;
}
