import { useEffect, useState } from 'react';
import { wrongBookService } from '../../services/wrongBookService';
import type { WrongBookBackfillPreview, WrongBookCollectionJobView } from '../../../shared/wrongbook';
import { AnswerText } from './QuestionSnapshot';
import { wrongBookDate } from './format';
import Pagination, { wrongBookButton } from './Pagination';

const reasons: Record<string, string> = { eligible: '可补录', already_recorded: '已收录', correct: '答案正确', unanswered: '未作答', subjective: '主观题', not_wrong_at_submission: '提交时未判错' };

export default function WrongBookMaintenance({ onChange }: { onChange: () => void }) {
  const [jobs, setJobs] = useState<WrongBookCollectionJobView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [jobError, setJobError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [source, setSource] = useState<'all' | 'practice' | 'exam'>('all');
  const [preview, setPreview] = useState<WrongBookBackfillPreview | null>(null);
  const [expiredAt, setExpiredAt] = useState(0);
  const [previewError, setPreviewError] = useState('');
  const [rowPage, setRowPage] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const silentlySkipped = preview?.rows.filter(row => row.disposition === 'error' && row.reason === '历史考试缺少提交时间。').length ?? 0;
  const previewRows = preview?.rows.filter(row => !(row.disposition === 'error' && row.reason === '历史考试缺少提交时间。')) ?? [];

  useEffect(() => {
    let active = true;
    setLoading(true); setJobError('');
    wrongBookService.getCollectionJobs(page, 5).then(response => {
      if (!active) return;
      const maxPage = Math.max(1, Math.ceil(response.data.total / 5));
      if (page > maxPage) { setPage(maxPage); return; }
      setJobs(response.data.jobs); setTotal(response.data.total);
    }).catch(reason => { if (active) setJobError(reason instanceof Error ? reason.message : '收录状态加载失败。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, version]);

  const retry = async (id: string) => {
    setBusy(id); setNotice(''); setNoticeError(false);
    try {
      const response = await wrongBookService.retryCollection(id);
      if (response.data.status === 'pending') { setNoticeError(true); setNotice(response.data.message || '提交已保留，收录仍未完成，请稍后重试。'); }
      else { setNotice('错题收录已完成。'); onChange(); }
      setVersion(value => value + 1);
    } catch (reason) { setNoticeError(true); setNotice(`重试失败：${reason instanceof Error ? reason.message : '请稍后重试。'}`); }
    finally { setBusy(''); }
  };
  const loadPreview = async () => {
    setBusy('preview'); setPreviewError(''); setPreview(null); setConfirmed(false); setNotice('');
    try {
      const response = await wrongBookService.previewBackfill(source);
      setPreview(response.data); setExpiredAt(Date.now() + response.data.expiresInSeconds * 1000); setRowPage(1);
    } catch (reason) { setPreviewError(reason instanceof Error ? reason.message : '补录预览加载失败。'); }
    finally { setBusy(''); }
  };
  const execute = async () => {
    if (!preview || !confirmed || busy) return;
    if (Date.now() >= expiredAt) { setPreviewError('预览已过期，请重新生成。'); setPreview(null); return; }
    setBusy('execute'); setPreviewError(''); setNoticeError(false);
    try {
      const response = await wrongBookService.executeBackfill(preview.previewToken);
      const remainingAnomalies = Math.max(0, response.data.anomalies - silentlySkipped);
      setNotice(`补录完成：新增 ${response.data.added} 条错误记录，跳过 ${response.data.skipped + silentlySkipped} 条。${remainingAnomalies ? `另有 ${remainingAnomalies} 条记录无法补录。` : ''}`);
      setPreview(null); setConfirmed(false); setVersion(value => value + 1); onChange();
    } catch (reason) { setPreviewError(reason instanceof Error ? reason.message : '补录失败，请重试。'); }
    finally { setBusy(''); }
  };

  return <div className="space-y-3">
    {notice && <p className={`rounded-lg border p-3 text-sm ${noticeError ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200' : 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200'}`} role={noticeError ? 'alert' : 'status'}>{notice}</p>}
    {(loading || jobError || total > 0) && <section aria-label="待收录任务" className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-gray-900 dark:text-gray-100">待收录任务{total > 0 ? `（${total}）` : ''}</h2><span className="text-xs text-gray-500">提交结果已保存</span></div>
      {loading ? <p className="mt-2 text-sm text-gray-500">正在检查收录状态…</p> : jobError ? <div className="mt-3 text-sm text-red-700" role="alert"><p>{jobError}</p><button className={`${wrongBookButton} mt-2`} type="button" onClick={() => setVersion(value => value + 1)}>重试收录状态</button></div> : <>
        <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">{jobs.map(job => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={job.id}>
          <div className="min-w-0 text-sm"><p className="break-all text-gray-800 dark:text-gray-200">{job.sourceType === 'exam' ? '考试' : '练习'} · {job.sourceSessionId}</p><p className="mt-1 text-xs text-gray-500">{job.lastError || '错题尚未收录，请重试。'}</p></div>
          <button className={wrongBookButton} disabled={!!busy} type="button" onClick={() => retry(job.id)}>{busy === job.id ? '收录中…' : '重试收录'}</button>
        </li>)}</ul>
        {total > 5 && <Pagination label="收录任务分页" limit={5} page={page} total={total} onChange={setPage} />}
      </>}
    </section>}
    <details className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <summary className="cursor-pointer px-4 py-3 font-medium text-gray-800 dark:text-gray-100">历史错题补录</summary>
      <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-700">
        <p className="text-sm leading-relaxed text-gray-500">扫描当前账号已完成的练习和考试，先预览，再确认补录。已收录的来源会跳过；历史快照不完整的记录会单独标明。</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm text-gray-600 dark:text-gray-300">补录来源<select aria-label="补录来源" className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" disabled={!!busy} value={source} onChange={event => { setSource(event.target.value as typeof source); setPreview(null); setConfirmed(false); setPreviewError(''); }}><option value="all">练习和考试</option><option value="practice">仅练习</option><option value="exam">仅考试</option></select></label>
          <button className={wrongBookButton} disabled={!!busy} type="button" onClick={loadPreview}>{busy === 'preview' ? '正在扫描…' : '生成只读预览'}</button>
        </div>
        {previewError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200" role="alert">{previewError} 可重新生成预览后再试。</p>}
        {preview && <section aria-label="历史补录预览" className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">{[
            ['新增明细', preview.newOccurrences], ['涉及题目', preview.newQuestions], ['跳过记录', preview.skipped + silentlySkipped],
            ...(preview.anomalies > silentlySkipped ? [['异常记录', preview.anomalies - silentlySkipped]] : []),
          ].map(([label, value]) => <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/30" key={label}><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p></div>)}</div>
          <p className="text-sm text-gray-500">已完成场次 {preview.completedSources} · 排除场次 {preview.excludedSources} · 已收录 {preview.alreadyRecorded} · 历史快照缺失 {preview.snapshotMissing}</p>
          <div className="question-browser-scroll max-h-96 space-y-2 overflow-y-scroll rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            {previewRows.slice((rowPage - 1) * 10, rowPage * 10).map((row, index) => <article className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/30" key={`${row.sourceSessionId}-${row.questionId}-${index}`}>
              <p className="break-all font-medium text-gray-800 dark:text-gray-200">{row.sourceType === 'exam' ? '考试' : '练习'} · {row.entry?.sourceTitle || row.sourceSessionId} · {reasons[row.reason] || row.reason}</p>
              {row.entry && <><p className="mt-1 text-xs text-gray-500">{wrongBookDate(row.entry.submittedAt)}</p><p className="mt-2 line-clamp-2 text-gray-700 dark:text-gray-300">{row.entry.snapshot.content}</p><div className="mt-2 text-red-700 dark:text-red-300"><AnswerText answer={row.entry.userAnswer} question={row.entry.snapshot} /></div></>}
              {row.snapshotMissing && <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">历史快照缺失，使用收录时题库内容</p>}
            </article>)}
            {!previewRows.length && <p className="p-3 text-gray-500">没有可补录的历史记录。</p>}
          </div>
          {previewRows.length > 10 && <Pagination label="补录预览分页" limit={10} page={rowPage} total={previewRows.length} onChange={setRowPage} />}
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200"><input checked={confirmed} className="mt-1 h-4 w-4 accent-amber-600" disabled={!!busy || !preview.newOccurrences} type="checkbox" onChange={event => setConfirmed(event.target.checked)} />我已核对预览，同意将可新增记录写入当前账号的错题本。</label>
          <button className={wrongBookButton} disabled={!!busy || !confirmed || !preview.newOccurrences} type="button" onClick={execute}>{busy === 'execute' ? '正在补录…' : '确认执行补录'}</button>
        </section>}
      </div>
    </details>
  </div>;
}
