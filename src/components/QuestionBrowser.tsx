import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ListOrdered, X } from 'lucide-react';

interface BrowserItem {
  id: string;
  status: 'study' | 'correct' | 'incorrect' | 'unanswered';
}
const labels = { study: '背题', correct: '正确', incorrect: '错误', unanswered: '未作答' };
const colors = {
  study: 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
  correct: 'border-green-400 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200',
  incorrect: 'border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200',
  unanswered: 'border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export default function QuestionBrowser({ title, subtitle, items, onClose, children, closeLabel = '返回练习中心', onSelect, selectedIndex, actions, legend }: {
  title: string;
  subtitle: ReactNode;
  items: BrowserItem[];
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
  onSelect?: (index: number) => void;
  selectedIndex?: number;
  actions?: ReactNode;
  legend?: ReactNode;
}) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  const reviewing = items.some(item => item.status !== 'study');

  useEffect(() => {
    const root = scrollRoot.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      const first = [...visible].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0] as HTMLElement | undefined;
      if (first) setCurrentIndex(Number(first.dataset.questionIndex));
    }, { root, threshold: 0 });
    root.querySelectorAll('[data-question-index]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [items.length]);

  const jump = (index: number) => {
    if (onSelect) {
      setCurrentIndex(index);
      setCardOpen(false);
      if (scrollRoot.current) scrollRoot.current.scrollTop = 0;
      onSelect(index);
      return;
    }
    const root = scrollRoot.current;
    const target = root?.querySelector<HTMLElement>(`[data-question-index="${index}"]`);
    if (!root || !target) return;
    setCurrentIndex(index);
    setCardOpen(false);
    root.scrollTop += target.getBoundingClientRect().top - root.getBoundingClientRect().top;
    target.focus({ preventScroll: true });
  };

  return (
    <section aria-label={title} className="flex h-[calc(100dvh-10rem)] min-h-[16rem] flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <header className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">{title}</h2>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button aria-expanded={cardOpen} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200 lg:hidden" type="button" onClick={() => setCardOpen(value => !value)}>
            <ListOrdered className="h-4 w-4" />答题卡
          </button>
          <button aria-label={`退出${title}`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-gray-300 dark:hover:bg-gray-700" type="button" onClick={onClose}>
            <span className="hidden text-sm sm:inline">{closeLabel}</span><X className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div data-question-scroll-container className="question-browser-scroll min-h-0 min-w-0 overflow-y-scroll overscroll-contain p-4 sm:p-6" ref={scrollRoot}>
          {children}
        </div>
        <aside aria-label="答题卡" className={`${cardOpen ? 'absolute inset-y-0 right-0 z-20 flex w-72 max-w-full shadow-xl' : 'hidden'} min-h-0 flex-col border-l border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:static lg:flex lg:w-auto lg:shadow-none`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">答题卡</h3>
            <button aria-label="关闭答题卡" className="rounded p-2 text-gray-500 lg:hidden" type="button" onClick={() => setCardOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <p className="my-3 text-sm text-gray-500 dark:text-gray-400">共 {items.length} 题 · 点击题号跳转</p>
          {legend ?? (reviewing && <div className="mb-3 flex flex-wrap gap-3 text-xs"><span className="text-green-700 dark:text-green-300">绿色：正确</span><span className="text-red-600 dark:text-red-300">红色：错误</span><span className="text-gray-500 dark:text-gray-400">灰色：未作答</span></div>)}
          <nav aria-label="题号导航" className="question-browser-scroll grid min-h-0 flex-1 content-start grid-cols-5 gap-2 overflow-y-auto p-1">
            {items.map((item, index) => <button aria-current={index === (selectedIndex ?? currentIndex) ? 'step' : undefined} aria-label={`第 ${index + 1} 题，${labels[item.status]}`} className={`flex h-10 items-center justify-center rounded-md border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${colors[item.status]} ${index === (selectedIndex ?? currentIndex) ? 'ring-2 ring-amber-600 ring-offset-2 dark:ring-offset-gray-800' : ''}`} key={item.id} type="button"
              onClick={() => jump(index)}>
              {index + 1}
            </button>)}
          </nav>
        </aside>
      </div>
    </section>
  );
}
