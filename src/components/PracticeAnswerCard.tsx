interface PracticeAnswerCardProps {
  questions: { id: string }[];
  answers: Record<string, string | string[]>;
  currentIndex: number;
  disabled: boolean;
  onSelect: (index: number) => void;
}

export default function PracticeAnswerCard({ questions, answers, currentIndex, disabled, onSelect }: PracticeAnswerCardProps) {
  const answered = (id: string) => {
    const value = answers[id];
    return Array.isArray(value) ? value.some(item => item.trim()) : !!value?.trim();
  };
  const count = questions.filter(question => answered(question.id)).length;
  return (
    <aside aria-label="答题卡" className="min-w-0 rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800 sm:p-5 lg:sticky lg:top-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">答题卡</h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">已答 {count} / {questions.length} 题</p>
      <div className="my-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-500 bg-amber-100 dark:bg-amber-900/40" />已答</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-gray-300 dark:border-gray-600" />未答</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-amber-600" />当前题</span>
      </div>
      <nav aria-label="题号导航" className="grid max-h-[60vh] grid-cols-6 gap-2 overflow-y-auto p-1 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((question, index) => {
          const done = answered(question.id);
          return (
            <button aria-current={index === currentIndex ? 'step' : undefined} aria-label={`第 ${index + 1} 题，${done ? '已答' : '未答'}`} className={`flex h-10 min-w-0 items-center justify-center rounded-md border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-wait ${done
              ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
              : 'border-gray-300 bg-white text-gray-600 enabled:hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:enabled:hover:bg-gray-700'} ${index === currentIndex ? 'ring-2 ring-amber-600 ring-offset-2 dark:ring-offset-gray-800' : ''}`}
            disabled={disabled}
            key={question.id}
            type="button"
            onClick={() => onSelect(index)}>
              {index + 1}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
