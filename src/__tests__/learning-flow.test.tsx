import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, Link } from 'react-router-dom';
import Login from '../pages/Login';
import Practice from '../pages/Practice';
import Layout from '../components/Layout';
import { TeacherRoute } from '../routes/TeacherRoute';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { loginDestination } from '../utils/loginDestination';
import { questionService } from '../services/questionService';
import { practiceService } from '../services/practiceService';
import { useAuthStore } from '../stores/auth';

jest.mock('../stores/auth', () => ({ useAuthStore: Object.assign(jest.fn(), { getState: jest.fn() }) }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', isDark: false, toggleTheme: jest.fn(), setLightTheme: jest.fn(), setDarkTheme: jest.fn(), setSystemTheme: jest.fn() }) }));
jest.mock('../services/questionService', () => ({ questionService: { getTopics: jest.fn(), getAllQuestions: jest.fn() } }));
jest.mock('../services/practiceService', () => ({ practiceService: { startPractice: jest.fn(), submitPractice: jest.fn(), getPracticeQuestion: jest.fn(), getSessionDetail: jest.fn(), getSessionResult: jest.fn() } }));
jest.mock('../components/MathRenderer', () => ({ __esModule: true, default: ({ content }: any) => <span>{content}</span> }));
jest.mock('../components/ai/AIChatButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ai/AIChatPanel', () => ({ __esModule: true, default: () => null }));

let auth: any;
let storage: Map<string, string>;
const question = { id: 'q1', topicId: 'chapter', type: 'single', content: '测试题目', options: [{ id: 'A', content: '选项甲' }, { id: 'B', content: '选项乙' }], answer: 'A', analysis: '', tags: [] };
const session = { id: 'session', userId: 'student', status: 'in_progress' };
function Location() { const l = useLocation(); return <output data-testid="location">{l.pathname + l.search + l.hash}</output>; }
beforeEach(() => {
  jest.clearAllMocks();
  storage = new Map();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn(),
  } });
  (localStorage.getItem as jest.Mock).mockImplementation(key => storage.get(key) ?? null);
  (localStorage.setItem as jest.Mock).mockImplementation((key, value) => storage.set(key, value));
  (localStorage.removeItem as jest.Mock).mockImplementation(key => storage.delete(key));
  auth = { user: { id: 'student', email: 'student@example.com' }, isAuthenticated: false, login: jest.fn().mockResolvedValue(undefined), clearError: jest.fn(), isLoading: false };
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => selector ? selector(auth) : auth);
  (useAuthStore.getState as jest.Mock).mockImplementation(() => auth);
  (questionService.getTopics as jest.Mock).mockResolvedValue({ success: true, data: [{ id: 'subject', name: '课程' }, { id: 'chapter', parentId: 'subject', name: '章节' }] });
  (questionService.getAllQuestions as jest.Mock).mockResolvedValue({ data: { total: 2, questions: [question] } });
  (practiceService.startPractice as jest.Mock).mockResolvedValue({ success: true, data: session });
  (practiceService.getPracticeQuestion as jest.Mock).mockResolvedValue({ success: true, data: question });
  (practiceService.getSessionDetail as jest.Mock).mockResolvedValue({ success: true, data: { session } });
  (practiceService.submitPractice as jest.Mock).mockResolvedValue({ success: true, data: { totalCount: 1 } });
  (practiceService.getSessionResult as jest.Mock).mockResolvedValue({ success: true, data: { results: [], total: 1, correct: 1, totalQuestions: 2 } });
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
});
afterEach(cleanup);

test('login returns to the original path', async () => {
  render(<MemoryRouter initialEntries={['/wrongbook?filter=unmastered#review']}><Location /><Routes><Route path="/wrongbook" element={<ProtectedRoute><div>错题本</div></ProtectedRoute>} /><Route path="/login" element={<Login />} /></Routes></MemoryRouter>);
  await screen.findByRole('button', { name: '登录' });
  auth.isAuthenticated = true;
  fireEvent.change(screen.getByLabelText('用户名或邮箱'), { target: { value: 'student' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  await screen.findByText('错题本');
  expect(screen.getByTestId('location')).toHaveTextContent('/wrongbook?filter=unmastered#review');
});

test.each([null, { pathname: '//example.com' }, { pathname: '/\\example.com' }, { pathname: '/login' }, { pathname: 'https://example.com' }])('rejects invalid login destination %j', from => {
  expect(loginDestination(from)).toBe('/');
});

test('password toggle is keyboard operable, named and keeps the entered value', () => {
  render(<MemoryRouter><Login /></MemoryRouter>);
  const input = screen.getByLabelText('密码');
  fireEvent.change(input, { target: { value: 'password123' } });
  const button = screen.getByRole('button', { name: '显示密码' });
  button.focus();
  expect(button).toHaveFocus();
  fireEvent.click(button); // native button activation is shared by pointer, Enter and Space
  expect(input).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: '隐藏密码' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '隐藏密码' }));
  expect(input).toHaveValue('password123');
  expect(input).toHaveAttribute('type', 'password');
});

async function begin(list = false) {
  window.matchMedia = jest.fn().mockReturnValue({ matches: list }) as any;
  const view = render(<Practice />);
  await screen.findByRole('option', { name: '课程' });
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'subject' } });
  fireEvent.change(selects[1], { target: { value: 'chapter' } });
  await waitFor(() => expect(questionService.getAllQuestions).toHaveBeenCalledWith(expect.objectContaining({ topicId: 'chapter' }), true));
  fireEvent.click(screen.getByRole('button', { name: '开始练习' }));
  await screen.findByText('测试题目');
  return view;
}

test.each([false, true])('refresh remount restores unsubmitted answer in list=%s', async list => {
  const view = await begin(list);
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  view.unmount();
  render(<Practice />);
  expect(await screen.findByRole('radio', { name: /选项甲/ })).toBeChecked();
  expect(screen.queryByText(/答案自动保存到当前浏览器/)).not.toBeInTheDocument();
  expect(practiceService.startPractice).toHaveBeenCalledTimes(1);
  expect(practiceService.submitPractice).not.toHaveBeenCalled();
});

test('offline save failure keeps answer and current question and supports retry', async () => {
  await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByText(/当前处于离线状态/)).toBeInTheDocument();
  (practiceService.submitPractice as jest.Mock).mockRejectedValueOnce(new Error('network offline'));
  fireEvent.click(screen.getByRole('button', { name: '下一题' }));
  await screen.findByText(/答案尚未同步/);
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
  expect(practiceService.getPracticeQuestion).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event('online')));
  expect(practiceService.submitPractice).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('radio', { name: /选项乙/ }));
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(practiceService.submitPractice).toHaveBeenCalledTimes(2));
  expect(practiceService.submitPractice).toHaveBeenLastCalledWith('session', [{ questionId: 'q1', userAnswer: 'B' }], false);
});

test('route exit and return restores the unfinished practice', async () => {
  const view = await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  view.unmount();
  render(<MemoryRouter initialEntries={['/other']}><Routes><Route path="/other" element={<Link to="/practice">返回练习</Link>} /><Route path="/practice" element={<Practice />} /></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: '返回练习' }));
  expect(await screen.findByRole('radio', { name: /选项甲/ })).toBeChecked();
});

test('drafts are isolated between accounts', async () => {
  const view = await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  auth.user = { id: 'another-student' };
  view.rerender(<Practice />);
  expect(screen.getByText('练习中心')).toBeInTheDocument();
  expect(screen.queryByText('测试题目')).not.toBeInTheDocument();
});

test('completed submit clears local draft; a failed submit preserves it', async () => {
  await begin(true);
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '我已确认上述说明' }));
  (practiceService.submitPractice as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  await screen.findByText(/提交失败，答案仍保留/);
  expect(storage.size).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  await waitFor(() => expect(storage.size).toBe(0));
});

test('multiple-choice draft restores every selected option', async () => {
  (practiceService.getPracticeQuestion as jest.Mock).mockResolvedValue({ success: true, data: { ...question, type: 'multiple', answer: ['A', 'B'] } });
  const view = await begin();
  fireEvent.click(screen.getByRole('checkbox', { name: /选项甲/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /选项乙/ }));
  view.unmount();
  render(<Practice />);
  expect(await screen.findByRole('checkbox', { name: /选项甲/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /选项乙/ })).toBeChecked();
});

test('corrupt draft does not crash practice', async () => {
  storage.set('question-bank:practice-draft:v1:student', '{invalid');
  render(<Practice />);
  expect(screen.getByText('练习中心')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('无法读取本地草稿');
});

test('storage quota failure is visible and editing remains possible', async () => {
  await begin();
  (localStorage.setItem as jest.Mock).mockImplementation(() => { throw new Error('quota'); });
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('草稿未能保存到本机');
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
});

test('server-completed session is not offered as an active draft', async () => {
  const view = await begin();
  view.unmount();
  (practiceService.getSessionDetail as jest.Mock).mockResolvedValue({ success: true, data: { session: { ...session, status: 'completed' } } });
  render(<Practice />);
  await screen.findByText(/上次练习已结束/);
  expect(screen.queryByText('练习进行中')).not.toBeInTheDocument();
  expect(storage.size).toBe(0);
});

test.each([[false, 0], [false, 1], [true, 0], [true, 1]])('save and resume from either entry, list=%s entry=%s', async (list, entry) => {
  const view = await begin(list);
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
  await screen.findAllByRole('button', { name: '继续上次练习' });
  expect(practiceService.submitPractice).toHaveBeenLastCalledWith('session', [{ questionId: 'q1', userAnswer: 'A' }], false);
  expect(practiceService.getSessionResult).not.toHaveBeenCalled();
  expect(storage.size).toBe(1);
  expect(screen.queryByText('练习回顾')).not.toBeInTheDocument();
  view.unmount();
  render(<Practice />);
  const resumeButtons = await screen.findAllByRole('button', { name: '继续上次练习' });
  fireEvent.click(resumeButtons[entry]);
  expect(await screen.findByRole('radio', { name: /选项甲/ })).toBeChecked();
  expect(practiceService.startPractice).toHaveBeenCalledTimes(1);
});

test('save and exit failure keeps the practice and answers available', async () => {
  await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  (practiceService.submitPractice as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
  await screen.findByText(/保存失败，答案仍保留/);
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
  expect(screen.getByRole('button', { name: '保存并退出' })).toBeEnabled();
  expect(storage.size).toBe(1);
  expect(practiceService.getSessionResult).not.toHaveBeenCalled();
});

test.each([false, true])('unanswered practice exits directly without saving or confirming, list=%s', async list => {
  await begin(list);
  expect(screen.getByRole('button', { name: '提交答案' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
  expect(screen.queryByText('提交确认')).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  expect(screen.getByText('练习中心')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '保存并退出' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '继续上次练习' })).not.toBeInTheDocument();
  expect(practiceService.submitPractice).not.toHaveBeenCalled();
  expect(storage.size).toBe(0);
});

test.each([false, true])('blank text is not counted as an answer, list=%s', async list => {
  const textQuestion = { ...question, type: 'fill', content: '测试题目', options: undefined };
  (questionService.getAllQuestions as jest.Mock).mockResolvedValue({ data: { total: 2, questions: [textQuestion] } });
  (practiceService.getPracticeQuestion as jest.Mock).mockResolvedValue({ success: true, data: textQuestion });
  await begin(list);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: '提交答案' })).toBeDisabled();
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  expect(screen.getByText('练习中心')).toBeInTheDocument();
});

test('unchecking every multiple choice disables submit and exits without confirmation', async () => {
  (practiceService.getPracticeQuestion as jest.Mock).mockResolvedValue({ success: true, data: { ...question, type: 'multiple', answer: ['A'] } });
  await begin();
  const option = screen.getByRole('checkbox', { name: /选项甲/ });
  fireEvent.click(option);
  expect(screen.getByRole('button', { name: '提交答案' })).toBeEnabled();
  fireEvent.click(option);
  expect(screen.getByRole('button', { name: '提交答案' })).toBeDisabled();
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  expect(screen.getByText('练习中心')).toBeInTheDocument();
  expect(practiceService.submitPractice).not.toHaveBeenCalled();
});

test('confirmation is portalled to the viewport and save notice disappears after 3 seconds', async () => {
  await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  expect(screen.getByRole('dialog', { name: '练习确认' }).parentElement).toBe(document.body);
  jest.useFakeTimers();
  try {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存并退出' })); });
    expect(screen.getByText(/进度已保存，练习尚未提交/)).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(2999));
    expect(screen.getByText(/进度已保存，练习尚未提交/)).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText(/进度已保存，练习尚未提交/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '继续上次练习' })).toHaveLength(2);
  } finally { jest.useRealTimers(); }
});

async function openMemorization() {
  render(<Practice />);
  await screen.findByRole('option', { name: '课程' });
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'subject' } });
  fireEvent.change(selects[1], { target: { value: 'chapter' } });
  fireEvent.click(screen.getByRole('button', { name: '背题模式' }));
}

test('memorization shows only question/options, highlights answers, and never creates a practice session', async () => {
  await openMemorization();
  const card = await screen.findByRole('article', { name: '第 1 题' });
  expect(within(card).getByText('测试题目')).toBeInTheDocument();
  expect(within(card).getByText('正确答案').parentElement?.parentElement).toHaveClass('border-amber-500');
  expect(screen.queryByText('你的答案')).not.toBeInTheDocument();
  expect(screen.queryByText('参考答案')).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(practiceService.startPractice).not.toHaveBeenCalled();
  expect(practiceService.submitPractice).not.toHaveBeenCalled();
  expect(storage.size).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '返回练习中心' }));
  expect(screen.getAllByRole('combobox')[1]).toHaveValue('chapter');
});

test('memorization loads every page and handles multiple-choice and text answers', async () => {
  (questionService.getAllQuestions as jest.Mock).mockImplementation(({ limit, page }: any) => Promise.resolve({ data: limit === 1
    ? { total: 101, questions: [] }
    : { total: 101, totalPages: 2, questions: page === 1
      ? [{ ...question, type: 'multiple', answer: ['A', 'B'] }]
      : [{ ...question, id: 'q2', type: 'fill', options: undefined, answer: ['填空答案一', '填空答案二'] }] } }));
  await openMemorization();
  const first = await screen.findByRole('article', { name: '第 1 题' });
  const second = screen.getByRole('article', { name: '第 2 题' });
  expect(within(first).getAllByText('正确答案')).toHaveLength(2);
  expect(within(second).getByText('填空答案一')).toBeInTheDocument();
  expect(within(second).getByText('填空答案二')).toBeInTheDocument();
  expect(questionService.getAllQuestions).toHaveBeenCalledWith({ topicId: 'chapter', page: 2, limit: 100 }, true);
});

test('memorization load failure stays in the center and supports retry', async () => {
  (questionService.getAllQuestions as jest.Mock).mockImplementation(({ limit }: any) => limit === 100
    ? Promise.reject(new Error('offline')) : Promise.resolve({ data: { total: 2, questions: [] } }));
  await openMemorization();
  await screen.findByText('背题题目加载失败，请重试。');
  expect(screen.getByRole('button', { name: '背题模式' })).toBeEnabled();
  (questionService.getAllQuestions as jest.Mock).mockResolvedValue({ data: { total: 1, questions: [question] } });
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByRole('article');
});

test('memorization leaves paused practice and its answer intact', async () => {
  await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
  await screen.findAllByRole('button', { name: '继续上次练习' });
  const draft = storage.get('question-bank:practice-draft:v1:student');
  fireEvent.click(screen.getByRole('button', { name: '背题模式' }));
  await screen.findByRole('article');
  expect(storage.get('question-bank:practice-draft:v1:student')).toBe(draft);
  fireEvent.click(screen.getByRole('button', { name: '退出背题模式' }));
  fireEvent.click(screen.getAllByRole('button', { name: '继续上次练习' })[0]);
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
  expect(practiceService.startPractice).toHaveBeenCalledTimes(1);
});

test.each([false, true])('practice has no memorization toggle and submits into review, list=%s', async list => {
  await begin(list);
  expect(screen.queryByText('背题模式')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '我已确认上述说明' }));
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  await screen.findByText('练习回顾');
  expect(practiceService.getSessionResult).toHaveBeenCalledWith('session');
  expect(storage.size).toBe(0);
});

function navigationQuestions() {
  const questions = [question,
    { ...question, id: 'q2', content: '第二道题目', type: 'multiple', answer: ['A', 'B'] },
    { ...question, id: 'q3', content: '第三道题目', type: 'fill', options: undefined, answer: '参考填空' },
  ];
  (questionService.getAllQuestions as jest.Mock).mockResolvedValue({ data: { total: 3, totalPages: 1, questions } });
  return questions;
}

test('single choice saves the selected answer and advances; the answer card jumps to any unvisited question', async () => {
  navigationQuestions();
  await begin();
  await screen.findByRole('button', { name: '第 3 题，未答' });
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  await screen.findByText('第二道题目');
  expect(practiceService.submitPractice).toHaveBeenLastCalledWith('session', [{ questionId: 'q1', userAnswer: 'A' }], false);
  expect(screen.getByRole('button', { name: '第 1 题，已答' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '第 2 题，未答' })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(screen.getByRole('button', { name: '第 3 题，未答' }));
  expect(screen.getByText('第三道题目')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '我的填空' } });
  fireEvent.click(screen.getByRole('button', { name: '第 1 题，已答' }));
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '第 3 题，已答' }));
  expect(screen.getByRole('textbox')).toHaveValue('我的填空');
  expect(practiceService.getPracticeQuestion).toHaveBeenCalledTimes(1);
});

test('multiple choice keeps all selections until Next; the last question never auto-submits', async () => {
  const questions = navigationQuestions();
  questions[2] = { ...question, id: 'q3', content: '最后一道题目' } as any;
  await begin();
  fireEvent.click(await screen.findByRole('button', { name: '第 2 题，未答' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /选项甲/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /选项乙/ }));
  expect(screen.getByText('第二道题目')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一题' }));
  await screen.findByText('最后一道题目');
  expect(practiceService.submitPractice).toHaveBeenLastCalledWith('session', [{ questionId: 'q2', userAnswer: ['A', 'B'] }], false);
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  expect(screen.getByText('最后一道题目')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '下一题' })).toBeDisabled();
  expect(practiceService.getSessionResult).not.toHaveBeenCalled();
});

test('save and exit, refresh and resume restore the displayed unanswered question instead of the last answered one', async () => {
  navigationQuestions();
  const view = await begin();
  await screen.findByRole('button', { name: '第 3 题，未答' });
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  await screen.findByText('第二道题目');
  fireEvent.click(screen.getByRole('button', { name: '第 3 题，未答' }));
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
  await screen.findAllByRole('button', { name: '继续上次练习' });
  expect(JSON.parse(storage.get('question-bank:practice-draft:v1:student')!).state.currentIndex).toBe(2);
  view.unmount();
  render(<Practice />);
  fireEvent.click((await screen.findAllByRole('button', { name: '继续上次练习' }))[0]);
  expect(screen.getByText('第三道题目')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '第 3 题，未答' })).toHaveAttribute('aria-current', 'step');
  expect(practiceService.startPractice).toHaveBeenCalledTimes(1);
});

test('failed automatic save keeps the selected answer on the current question and retry advances once', async () => {
  navigationQuestions();
  await begin();
  await screen.findByRole('button', { name: '第 3 题，未答' });
  (practiceService.submitPractice as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  await screen.findByText(/答案尚未同步/);
  expect(screen.getByText('测试题目')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
  expect(screen.getByRole('button', { name: '第 1 题，已答' })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('第二道题目');
  expect(practiceService.submitPractice).toHaveBeenCalledTimes(2);
});

test('saved progress notice is green and can be dismissed without changing the paused practice', async () => {
  await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
  const message = await screen.findByText(/进度已保存，练习尚未提交/);
  expect(message.parentElement).toHaveClass('bg-green-50');
  fireEvent.click(screen.getByRole('button', { name: '关闭提示' }));
  expect(screen.queryByText(/进度已保存，练习尚未提交/)).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: '继续上次练习' })).toHaveLength(2);
  expect(storage.size).toBe(1);
});

test('legacy practice draft gains a complete answer card without changing its displayed question', async () => {
  const view = await begin();
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  view.unmount();
  navigationQuestions();
  render(<Practice />);
  await screen.findByRole('button', { name: '第 3 题，未答' });
  expect(screen.getByText('测试题目')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /选项甲/ })).toBeChecked();
  expect(screen.getByRole('button', { name: '第 1 题，已答' })).toHaveAttribute('aria-current', 'step');
});

test('list practice answer card scrolls to a question and restores that position after saving', async () => {
  navigationQuestions();
  const scroll = jest.fn();
  const originalScroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scroll;
  try {
    const view = await begin(true);
    fireEvent.click(screen.getAllByRole('radio', { name: /选项甲/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: '第 3 题，未答' }));
    expect(screen.getByRole('button', { name: '第 3 题，未答' })).toHaveAttribute('aria-current', 'step');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: '退出练习' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
    await screen.findAllByRole('button', { name: '继续上次练习' });
    view.unmount();
    render(<Practice />);
    fireEvent.click((await screen.findAllByRole('button', { name: '继续上次练习' }))[0]);
    expect(screen.getByRole('button', { name: '第 3 题，未答' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByRole('radio', { name: /选项甲/ })[0]).toBeChecked();
  } finally {
    Element.prototype.scrollIntoView = originalScroll;
  }
});

test('answer card loads pages beyond the first 100 questions', async () => {
  (questionService.getAllQuestions as jest.Mock).mockImplementation(({ limit, page }: any) => Promise.resolve({ data: {
    total: 101, totalPages: 2, questions: limit === 1 ? [] : page === 1 ? [question] : [{ ...question, id: 'q101', content: '后续分页题目' }],
  } }));
  await begin();
  fireEvent.click(await screen.findByRole('button', { name: '第 2 题，未答' }));
  expect(screen.getByText('后续分页题目')).toBeInTheDocument();
  expect(questionService.getAllQuestions).toHaveBeenCalledWith({ topicId: 'chapter', page: 2, limit: 100 }, true);
});

test.each(['admin', 'teacher', 'student'])('navigation exposes teacher functions to teachers and admins only, role=%s', role => {
  auth.user = { id: 'role-test', role, username: role };
  auth.isAuthenticated = true;
  render(<MemoryRouter><Layout><div>页面内容</div></Layout></MemoryRouter>);
  if (role === 'student') {
    expect(screen.queryByRole('link', { name: /题库管理/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /考试管理/ })).not.toBeInTheDocument();
  } else {
    expect(screen.getAllByRole('link', { name: /题库管理/ })[0]).toHaveAttribute('href', '/admin/question');
    expect(screen.getAllByRole('link', { name: /考试管理/ })[0]).toHaveAttribute('href', '/admin/exam');
  }
  expect(screen.queryAllByRole('link', { name: /用户管理/ }).length > 0).toBe(role === 'admin');
});

test.each(['admin', 'teacher', 'student'])('teacher route permits teacher and admin roles, role=%s', role => {
  auth.user = { id: 'role-test', role };
  auth.isAuthenticated = true;
  render(<MemoryRouter initialEntries={['/admin/question']}><Routes>
    <Route path="/admin/question" element={<TeacherRoute><div>题库管理页面</div></TeacherRoute>} />
    <Route path="/" element={<div>返回首页</div>} />
  </Routes></MemoryRouter>);
  expect(screen.getByText(role === 'student' ? '返回首页' : '题库管理页面')).toBeInTheDocument();
});

test('practice review answer card marks wrong answers red and the persistent header closes the review', async () => {
  (practiceService.getSessionResult as jest.Mock).mockResolvedValue({ success: true, data: { results: [
    { question, userAnswer: 'B', correctAnswer: 'A', isCorrect: false },
    { question: { ...question, id: 'q2' }, userAnswer: 'A', correctAnswer: 'A', isCorrect: true },
    { question: { ...question, id: 'q3' }, userAnswer: null, correctAnswer: 'A', isCorrect: false },
  ], total: 2, correct: 1, totalQuestions: 3 } });
  await begin(true);
  fireEvent.click(screen.getByRole('radio', { name: /选项甲/ }));
  fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '我已确认上述说明' }));
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  await screen.findByRole('heading', { name: '练习回顾' });
  expect(screen.getByRole('button', { name: '第 1 题，错误' })).toHaveClass('bg-red-50');
  expect(screen.getByRole('button', { name: '第 2 题，正确' })).toHaveClass('bg-green-50');
  expect(screen.getByRole('button', { name: '第 3 题，未作答' })).toHaveClass('bg-gray-50');
  fireEvent.click(screen.getByRole('button', { name: '退出练习回顾' }));
  expect(screen.getByRole('heading', { name: '练习中心' })).toBeInTheDocument();
});

test.each([false, true])('practice renders letter labels but preserves internal answer ids in list=%s', async list => {
  const internal = { ...question, options: [{ id: 'option-a', content: '选项甲' }, { id: 'option-b', content: '选项乙' }], answer: 'option-a' };
  (questionService.getAllQuestions as jest.Mock).mockResolvedValue({ data: { total: 1, questions: [internal] } });
  (practiceService.getPracticeQuestion as jest.Mock).mockResolvedValue({ success: true, data: internal });
  await begin(list);
  expect(screen.getByRole('radio', { name: 'A 选项甲' })).toHaveAttribute('value', 'option-a');
  expect(screen.getByRole('radio', { name: 'B 选项乙' })).toHaveAttribute('value', 'option-b');
  expect(screen.queryByText('option-a')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'B 选项乙' }));
  expect(screen.getByRole('radio', { name: 'B 选项乙' })).toBeChecked();
});
