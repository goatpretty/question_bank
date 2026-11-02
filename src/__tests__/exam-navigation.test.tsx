import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Exams from '../pages/Exams';
import { useExamStore } from '../stores/exam';
import { examService } from '../services/examService';

jest.mock('../services/examService', () => ({ examService: { getAllExams: jest.fn(), getExamHistory: jest.fn(), getExamQuestion: jest.fn(), submitExamAnswer: jest.fn(), getSubmissionResult: jest.fn() } }));
jest.mock('../components/MathRenderer', () => ({ __esModule: true, default: ({ content }: any) => <span>{content}</span> }));
jest.mock('../components/ExamResultModal', () => ({ __esModule: true, default: () => null }));
const options = [{ id: 'A', content: '选项甲' }, { id: 'B', content: '选项乙' }];
const questions = [
  { id: 'q1', type: 'single', content: '考试第一题', options },
  { id: 'q2', type: 'multiple', content: '考试第二题', options },
  { id: 'q3', type: 'single', content: '考试最后一题', options },
];
beforeEach(() => {
  jest.clearAllMocks();
  window.alert = jest.fn(); window.confirm = jest.fn(() => false);
  (examService.getAllExams as jest.Mock).mockResolvedValue({ data: { exams: [] } });
  (examService.getExamHistory as jest.Mock).mockResolvedValue({ data: { submissions: [] } });
  (examService.getExamQuestion as jest.Mock).mockImplementation(async (_sid, order) => ({ data: { question: questions[order - 1], order, totalQuestions: 3, userAnswer: null } }));
  (examService.submitExamAnswer as jest.Mock).mockResolvedValue({ data: {} });
  useExamStore.setState({ currentExam: { id: 'exam', name: '测试考试' } as any, submissionId: 'submission', currentQuestion: questions[0], currentQuestionIndex: 0, totalQuestions: 3, userAnswers: {}, currentAnswer: null, timeRemaining: 600, isLoading: false, error: null, examHistory: [], exams: [] });
});
afterEach(cleanup);

test('exam single choice saves before advancing and the answer card links any question', async () => {
  render(<Exams />);
  const first = await screen.findByRole('radio', { name: /选项甲/ });
  await waitFor(() => expect(first).toBeEnabled());
  fireEvent.click(first);
  await screen.findByText('考试第二题');
  expect(examService.submitExamAnswer).toHaveBeenCalledWith('submission', 'q1', 'A', false, 1);
  expect(screen.getByRole('button', { name: '第 1 题，已答' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '第 3 题，未答' }));
  await screen.findByText('考试最后一题');
  fireEvent.click(screen.getByRole('button', { name: '第 1 题，已答' }));
  await screen.findByText('考试第一题');
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
});

test('exam multiple choice permits several answers and waits for manual Next; last choice does not submit', async () => {
  render(<Exams />);
  await waitFor(() => expect(screen.getByRole('button', { name: '第 2 题，未答' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '第 2 题，未答' }));
  const first = await screen.findByRole('checkbox', { name: /选项甲/ });
  fireEvent.click(first);
  await waitFor(() => expect(first).toBeEnabled());
  fireEvent.click(screen.getByRole('checkbox', { name: /选项乙/ }));
  await waitFor(() => expect(first).toBeEnabled());
  expect(screen.getByText('考试第二题')).toBeInTheDocument();
  expect(useExamStore.getState().userAnswers[2]).toEqual(['A', 'B']);
  fireEvent.click(screen.getByRole('button', { name: '下一题' }));
  await screen.findByText('考试最后一题');
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /选项甲/ })).toBeEnabled());
  expect(screen.getByText('考试最后一题')).toBeInTheDocument();
  expect(examService.getSubmissionResult).not.toHaveBeenCalled();
  expect((examService.submitExamAnswer as jest.Mock).mock.calls.every(call => call[3] === false)).toBe(true);
});

test('automatic save failure keeps the current answer and question, and manual retry advances', async () => {
  (examService.submitExamAnswer as jest.Mock).mockRejectedValueOnce(new Error('网络暂时不可用'));
  render(<Exams />);
  await waitFor(() => expect(screen.getByRole('radio', { name: /选项甲/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时不可用');
  expect(screen.getByText('考试第一题')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '下一题' }));
  await screen.findByText('考试第二题');
  expect(examService.submitExamAnswer).toHaveBeenCalledTimes(2);
});
