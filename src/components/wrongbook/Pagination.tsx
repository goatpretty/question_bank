export const wrongBookButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-500';

export default function Pagination({ page, limit, total, loading, onChange, label = '错题列表分页' }: {
  page: number; limit: number; total: number; loading?: boolean; onChange: (page: number) => void; label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-gray-500 dark:text-gray-400">
    <span>第 {page} / {pages} 页 · 共 {total} 条</span>
    <div className="flex gap-2">
      <button className={wrongBookButton} disabled={loading || page <= 1} type="button" onClick={() => onChange(page - 1)}>上一页</button>
      <button className={wrongBookButton} disabled={loading || page >= pages} type="button" onClick={() => onChange(page + 1)}>下一页</button>
    </div>
  </nav>;
}
