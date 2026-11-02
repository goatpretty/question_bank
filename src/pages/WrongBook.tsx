import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Eye, RotateCcw } from 'lucide-react';
import { wrongBookService } from '../services/wrongBookService';
import { questionService } from '../services/questionService';
import { useAuthStore } from '../stores/auth';
import type { Topic } from '../../shared/types';
import type { WrongBookItemView, WrongBookListData, WrongBookQuestionType } from '../../shared/wrongbook';
import WrongBookDetail from '../components/wrongbook/WrongBookDetail';
import WrongBookMaintenance from '../components/wrongbook/WrongBookMaintenance';
import Pagination, { wrongBookButton } from '../components/wrongbook/Pagination';
import { wrongBookDate, wrongBookTypeLabels } from '../components/wrongbook/format';

interface Filters {
  subjectId: string; chapterId: string; type: '' | WrongBookQuestionType;
  mastery: 'all' | 'mastered' | 'unmastered'; sortBy: 'lastWrongAt' | 'wrongCount'; page: number;
}
const initialFilters: Filters = { subjectId: '', chapterId: '', type: '', mastery: 'all', sortBy: 'lastWrongAt', page: 1 };
const selectStyle = 'min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const message = (reason: unknown) => reason instanceof Error ? reason.message : '操作失败，请重试。';

export default function WrongBook() {
  const userId = useAuthStore(state => state.user?.id ?? '');
  return <WrongBookPage key={userId} />;
}

function WrongBookPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicError, setTopicError] = useState('');
  const [topicVersion, setTopicVersion] = useState(0);
  const [data, setData] = useState<WrongBookListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browserItems, setBrowserItems] = useState<WrongBookItemView[]>([]);
  const sequence = useRef(0);

  useEffect(() => {
    let active = true;
    setTopicError('');
    questionService.getTopics().then(response => {
      if (!response.success) throw new Error('课程与章节加载失败。');
      if (active) setTopics(response.data);
    }).catch(reason => { if (active) setTopicError(message(reason)); });
    return () => { active = false; };
  }, [topicVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const current = ++sequence.current;
    setLoading(true); setError('');
    wrongBookService.getWrongBook({
      page: filters.page, limit: 10, sortBy: filters.sortBy,
      subjectId: filters.subjectId || undefined, chapterId: filters.chapterId || undefined,
      type: filters.type || undefined,
      isMastered: filters.mastery === 'all' ? undefined : filters.mastery === 'mastered',
    }, controller.signal).then(response => {
      if (controller.signal.aborted || current !== sequence.current) return;
      const maxPage = Math.max(1, Math.ceil(response.data.total / 10));
      if (filters.page > maxPage) { setFilters(previous => ({ ...previous, page: maxPage })); return; }
      setData(response.data);
    }).catch(reason => { if (!controller.signal.aborted && current === sequence.current) setError(message(reason)); })
      .finally(() => { if (!controller.signal.aborted && current === sequence.current) setLoading(false); });
    return () => { controller.abort(); };
  }, [filters, version]);

  const updateFilters = (values: Partial<Filters>) => {
    setFilters(previous => ({ ...previous, ...values, page: 1 })); setFeedback(null);
  };
  const changeMastery = async (item: WrongBookItemView) => {
    if (busyId) return;
    setBusyId(item.questionId); setFeedback(null);
    try {
      await wrongBookService.markMastered(item.questionId, !item.isMastered);
      setFeedback({ text: item.isMastered ? '已恢复为未掌握。' : '已标记为已掌握。', error: false });
      setVersion(value => value + 1);
    } catch (reason) { setFeedback({ text: message(reason), error: true }); }
    finally { setBusyId(''); }
  };
  const refresh = () => setVersion(value => value + 1);
  const chapters = topics.filter(topic => filters.subjectId && topic.parentId === filters.subjectId);
  const activeFilters = filters.subjectId || filters.chapterId || filters.type || filters.mastery !== 'all';

  if (selectedId) return <WrongBookDetail items={browserItems} selectedId={selectedId} onClose={() => setSelectedId(null)}
    onMasteryChange={item => { setBrowserItems(previous => previous.map(row => row.questionId === item.questionId ? item : row)); refresh(); }} onSelect={setSelectedId} />;

  return <div className="mx-auto max-w-6xl space-y-5 pb-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">错题本</h1><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">按知识点复习，查看每次错误答案，逐步掌握薄弱环节。</p></div>
      <button className={wrongBookButton} disabled={loading} type="button" onClick={refresh}><RotateCcw className="h-4 w-4" />刷新</button>
    </header>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: '总错题数', value: data?.stats.total, color: 'text-gray-900 dark:text-gray-100' },
        { label: '未掌握', value: data?.stats.unmastered, color: 'text-red-600 dark:text-red-300' },
        { label: '已掌握', value: data?.stats.mastered, color: 'text-green-700 dark:text-green-300' },
        { label: '掌握率', value: data ? `${data.stats.masteryRate.toFixed(1)}%` : undefined, color: 'text-amber-700 dark:text-amber-300' },
      ].map(stat => <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" key={stat.label}><dt className="text-xs text-gray-500 sm:text-sm">{stat.label}</dt><dd className={`mt-2 text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value ?? '—'}</dd></div>)}
    </dl>
    <section aria-label="错题筛选" className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">课程<select aria-label="课程" className={selectStyle} value={filters.subjectId} onChange={event => updateFilters({ subjectId: event.target.value, chapterId: '' })}><option value="">全部课程</option>{topics.filter(topic => !topic.parentId).map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">章节<select aria-label="章节" className={selectStyle} disabled={!filters.subjectId} value={filters.chapterId} onChange={event => updateFilters({ chapterId: event.target.value })}><option value="">{filters.subjectId ? '全部章节' : '请先选择课程'}</option>{chapters.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">题型<select aria-label="题型" className={selectStyle} value={filters.type} onChange={event => updateFilters({ type: event.target.value as Filters['type'] })}><option value="">全部题型</option>{Object.entries(wrongBookTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">掌握状态<select aria-label="掌握状态" className={selectStyle} value={filters.mastery} onChange={event => updateFilters({ mastery: event.target.value as Filters['mastery'] })}><option value="all">全部状态</option><option value="unmastered">未掌握</option><option value="mastered">已掌握</option></select></label>
        <label className="col-span-2 grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 lg:col-span-1">排序<select aria-label="排序" className={selectStyle} value={filters.sortBy} onChange={event => updateFilters({ sortBy: event.target.value as Filters['sortBy'] })}><option value="lastWrongAt">最近错误</option><option value="wrongCount">错误次数</option></select></label>
      </div>
      {topicError && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-300" role="alert"><span>课程与章节加载失败：{topicError}</span><button className={wrongBookButton} type="button" onClick={() => setTopicVersion(value => value + 1)}>重试课程</button></div>}
    </section>
    {feedback && <div className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${feedback.error ? 'border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200' : 'border-green-200 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200'}`} role={feedback.error ? 'alert' : 'status'}><p>{feedback.text}</p><button aria-label="关闭操作提示" type="button" onClick={() => setFeedback(null)}>×</button></div>}
    <section aria-busy={loading} aria-label="错题列表" className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-5"><h2 className="font-semibold text-gray-900 dark:text-gray-100">错题列表</h2><span className="text-sm text-gray-500">{loading ? '正在更新…' : error ? '加载失败' : `共 ${data?.total ?? 0} 道错题`}</span></div>
      {loading ? <p className="px-5 py-16 text-center text-sm text-gray-500" role="status">正在加载错题…</p> : error ? <div className="px-5 py-12 text-center" role="alert"><p className="text-sm text-red-700 dark:text-red-300">{error}</p><button className={`${wrongBookButton} mt-4`} type="button" onClick={refresh}>重试列表</button></div> : !data?.wrongQuestions.length ? <div className="px-5 py-14 text-center"><BookOpen className="mx-auto mb-3 h-9 w-9 text-gray-400" /><h3 className="font-medium text-gray-900 dark:text-gray-100">{activeFilters ? '没有符合条件的错题' : '暂无错题'}</h3><p className="mt-2 text-sm text-gray-500">{activeFilters ? '调整筛选条件，或查看其他掌握状态。' : '正式提交练习或考试后，做错的客观题会收录到这里。'}</p>{activeFilters && <button className={`${wrongBookButton} mt-4`} type="button" onClick={() => setFilters(initialFilters)}>清空筛选</button>}</div> : <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {data.wrongQuestions.map((item, index) => <li className="px-4 py-5 sm:px-5" key={item.id}>
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{wrongBookTypeLabels[item.question.type]}</span><span className="min-w-0 break-words text-gray-500">{item.question.subjectName}{item.question.chapterName ? ` / ${item.question.chapterName}` : ''}</span><span className={`ml-auto inline-flex items-center gap-1 ${item.isMastered ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>{item.isMastered && <Check className="h-3 w-3" />}{item.isMastered ? '已掌握' : '未掌握'}</span></div>
          <button aria-label={`查看第 ${(filters.page - 1) * 10 + index + 1} 题详情`} className="mt-3 block w-full rounded text-left text-base font-medium leading-relaxed text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-gray-100" type="button" onClick={() => { setBrowserItems(data.wrongQuestions); setSelectedId(item.questionId); }}><span className="line-clamp-2 break-words">{item.question.content.replace(/<[^>]*>/g, '')}</span></button>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span className="text-red-600 dark:text-red-300">错误 {item.wrongCount} 次</span><span>最近错误：{wrongBookDate(item.lastWrongAt)}</span></div><div className="flex gap-2"><button className={wrongBookButton} disabled={!!busyId} type="button" onClick={() => changeMastery(item)}>{busyId === item.questionId ? '保存中…' : item.isMastered ? '恢复未掌握' : '标记已掌握'}</button><button className={wrongBookButton} type="button" onClick={() => { setBrowserItems(data.wrongQuestions); setSelectedId(item.questionId); }}><Eye className="h-4 w-4" />查看</button></div></div>
        </li>)}
      </ul>}
      {!loading && !error && data && data.total > 0 && <div className="border-t border-gray-200 px-4 dark:border-gray-700 sm:px-5"><Pagination limit={10} page={filters.page} total={data.total} onChange={page => setFilters(previous => ({ ...previous, page }))} /></div>}
    </section>
    <WrongBookMaintenance onChange={refresh} />
  </div>;
}
