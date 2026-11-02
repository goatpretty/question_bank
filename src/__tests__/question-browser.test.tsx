import { fireEvent, render, screen } from '@testing-library/react';
import QuestionBrowser from '../components/QuestionBrowser';

const items = [
  { id: 'q1', status: 'correct' as const },
  { id: 'q2', status: 'incorrect' as const },
  { id: 'q3', status: 'unanswered' as const },
];

test('review answer card distinguishes correct, incorrect and unanswered questions and scrolls only the content', () => {
  const onClose = jest.fn();
  const { container } = render(<QuestionBrowser title="练习回顾" subtitle="共 3 题" items={items} onClose={onClose}>
    {items.map((item, index) => <article key={item.id} tabIndex={-1} data-question-index={index}>题目 {index + 1}</article>)}
  </QuestionBrowser>);
  const scrollRoot = container.querySelector('[data-question-scroll-container]') as HTMLElement;
  const second = container.querySelector('[data-question-index="1"]') as HTMLElement;
  scrollRoot.getBoundingClientRect = jest.fn(() => ({ top: 100 }) as DOMRect);
  second.getBoundingClientRect = jest.fn(() => ({ top: 500 }) as DOMRect);
  expect(screen.getByRole('button', { name: '第 1 题，正确' })).toHaveClass('bg-green-50');
  const wrong = screen.getByRole('button', { name: '第 2 题，错误' });
  expect(wrong).toHaveClass('bg-red-50', 'text-red-700');
  expect(screen.getByRole('button', { name: '第 3 题，未作答' })).toHaveClass('bg-gray-50');
  fireEvent.click(wrong);
  expect(scrollRoot.scrollTop).toBe(400);
  expect(wrong).toHaveAttribute('aria-current', 'step');
  expect(second).toHaveFocus();
  const exit = screen.getByRole('button', { name: '退出练习回顾' });
  expect(scrollRoot.contains(exit)).toBe(false);
  fireEvent.click(exit);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('mobile answer-card toggle closes after choosing a question while the main exit stays available', () => {
  render(<QuestionBrowser title="背题模式" subtitle="共 1 题" items={[{ id: 'q1', status: 'study' }]} onClose={jest.fn()}>
    <article data-question-index="0" tabIndex={-1}>题目</article>
  </QuestionBrowser>);
  const toggle = screen.getByRole('button', { name: /^答题卡$/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: '第 1 题，背题' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: '退出背题模式' })).toBeInTheDocument();
});
