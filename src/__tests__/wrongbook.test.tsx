import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WrongBook from '../pages/WrongBook';
import QuestionSnapshot from '../components/wrongbook/QuestionSnapshot';
import WrongBookMaintenance from '../components/wrongbook/WrongBookMaintenance';
import { wrongBookService } from '../services/wrongBookService';
import { questionService } from '../services/questionService';
import type { WrongBookDetailData, WrongBookItemView, WrongBookListData, WrongBookOccurrenceView } from '../../shared/wrongbook';

jest.mock('../stores/auth', () => ({ useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'test-user' } }) }));
jest.mock('../services/wrongBookService', () => ({ wrongBookService: { getWrongBook: jest.fn(), getDetail: jest.fn(), markMastered: jest.fn(), getCollectionJobs: jest.fn(), retryCollection: jest.fn(), previewBackfill: jest.fn(), executeBackfill: jest.fn() } }));
jest.mock('../services/questionService', () => ({ questionService: { getTopics: jest.fn() } }));
jest.mock('../components/MathRenderer', () => ({ __esModule: true, default: ({ content }: { content: string }) => <span>{content}</span> }));

const service = wrongBookService as jest.Mocked<typeof wrongBookService>;
const topics = questionService as jest.Mocked<typeof questionService>;
const item = (id: string, mastered = false): WrongBookItemView => ({
  id: `item-${id}`, userId: 'test-user', questionId: id, wrongCount: 3, lastWrongAt: '2026-10-21T09:00:00Z', isMastered: mastered, masteredAt: null,
  question: { id, topicId: 'chapter', chapterName: '第一章', subjectId: 'subject', subjectName: '课程甲', type: 'multiple', content: `题干 ${id}`, options: [
    { id: 'option-c', content: '丙内容', displayLabel: 'A' }, { id: 'option-a', content: '甲内容', displayLabel: 'B' },
    { id: 'option-b', content: '乙内容', displayLabel: 'C' },
  ], answer: ['option-c', 'option-a'], analysis: '解析内容' },
});
const list = (rows = [item('q1'), item('q2')], total = 12): WrongBookListData => ({ wrongQuestions: rows, total, page: 1, limit: 10,
  stats: { total: 12, mastered: 4, unmastered: 8, masteryRate: 33.333 }, filteredStats: { total: 12, mastered: 4, unmastered: 8, masteryRate: 33.333 },
});
const occurrence = (id: string): WrongBookOccurrenceView => ({ id, sourceType: 'exam', sourceSessionId: 'exam-session', sourceAnswerId: 'answer', sourceTitle: '乱序考试',
  submittedAt: '2026-10-21T09:00:00Z', recordedAt: '2026-10-21T09:00:00Z', userAnswer: ['option-c', 'option-b'], correctAnswer: ['option-c', 'option-a'],
  userDisplayAnswer: ['A', 'C'], correctDisplayAnswer: ['A', 'B'], snapshotStatus: 'reconstructed', question: item('q1').question,
});
const detail = (id = 'q1', page = 1): WrongBookDetailData => ({ item: item(id), occurrences: [occurrence(`event-${page}`)], total: 7, page, limit: 5, legacyOccurrenceCount: 2 });

beforeEach(() => {
  jest.clearAllMocks();
  service.getWrongBook.mockResolvedValue({ success: true, data: list() });
  service.getDetail.mockImplementation(async (id, page) => ({ success: true, data: detail(id, page) }));
  service.getCollectionJobs.mockResolvedValue({ success: true, data: { jobs: [], total: 0 } });
  service.markMastered.mockImplementation(async (id, mastered) => ({ success: true, data: item(id, mastered) }));
  topics.getTopics.mockResolvedValue({ success: true, data: [{ id: 'subject', name: '课程甲', sortOrder: 0, createdAt: new Date() }, { id: 'other', name: '课程乙', sortOrder: 1, createdAt: new Date() }, { id: 'chapter', name: '第一章', parentId: 'subject', sortOrder: 0, createdAt: new Date() }] });
});

test('global statistics and totals come from the API rather than the current page', async () => {
  render(<WrongBook />);
  await screen.findByText('共 12 道错题');
  expect(screen.getByText('33.3%')).toBeInTheDocument();
  expect(screen.getAllByText('课程甲 / 第一章')).toHaveLength(2);
  expect(screen.getAllByText('错误 3 次')).toHaveLength(2);
  fireEvent.click(within(screen.getByRole('navigation', { name: '错题列表分页' })).getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(service.getWrongBook).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal)));
  fireEvent.change(screen.getByRole('combobox', { name: '排序' }), { target: { value: 'wrongCount' } });
  await waitFor(() => expect(service.getWrongBook).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sortBy: 'wrongCount' }), expect.any(AbortSignal)));
});

test('course/chapter/type/mastery filters compose and changing course clears chapter', async () => {
  render(<WrongBook />); await screen.findByText('共 12 道错题');
  expect(screen.getByRole('combobox', { name: '章节' })).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: '课程' }), { target: { value: 'subject' } });
  fireEvent.change(screen.getByRole('combobox', { name: '章节' }), { target: { value: 'chapter' } });
  fireEvent.change(screen.getByRole('combobox', { name: '题型' }), { target: { value: 'multiple' } });
  fireEvent.change(screen.getByRole('combobox', { name: '掌握状态' }), { target: { value: 'mastered' } });
  await waitFor(() => expect(service.getWrongBook).toHaveBeenLastCalledWith(expect.objectContaining({ subjectId: 'subject', chapterId: 'chapter', type: 'multiple', isMastered: true }), expect.any(AbortSignal)));
  fireEvent.change(screen.getByRole('combobox', { name: '课程' }), { target: { value: 'other' } });
  await waitFor(() => expect(service.getWrongBook).toHaveBeenLastCalledWith(expect.objectContaining({ subjectId: 'other', chapterId: undefined }), expect.any(AbortSignal)));
});

test('old list responses cannot overwrite a newer filter result', async () => {
  let resolveOld: (value: { success: boolean; data: WrongBookListData }) => void = () => {};
  service.getWrongBook.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  service.getWrongBook.mockResolvedValueOnce({ success: true, data: list([item('new')], 1) });
  render(<WrongBook />);
  fireEvent.change(screen.getByRole('combobox', { name: '题型' }), { target: { value: 'multiple' } });
  await screen.findByText('题干 new');
  await act(async () => resolveOld({ success: true, data: list([item('old')]) }));
  expect(screen.queryByText('题干 old')).not.toBeInTheDocument();
});

test('list errors have a retry and are distinct from empty filter results', async () => {
  service.getWrongBook.mockRejectedValueOnce(new Error('网络中断'));
  render(<WrongBook />); await screen.findByText('网络中断');
  expect(screen.queryByText('暂无错题')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试列表' })); await screen.findByText('共 12 道错题');
  service.getWrongBook.mockResolvedValue({ success: true, data: list([], 0) });
  fireEvent.change(screen.getByRole('combobox', { name: '题型' }), { target: { value: 'fill' } });
  await screen.findByText('没有符合条件的错题');
  fireEvent.click(screen.getByRole('button', { name: '清空筛选' })); await screen.findByText('暂无错题');
});

test('mastery waits for persisted success, supports reversing and reports failures', async () => {
  service.getWrongBook.mockResolvedValue({ success: true, data: list([item('q1')], 1) });
  render(<WrongBook />); await screen.findByText('题干 q1');
  service.markMastered.mockRejectedValueOnce(new Error('保存失败'));
  fireEvent.click(screen.getByRole('button', { name: '标记已掌握' })); await screen.findByText('保存失败');
  expect(screen.getByText('未掌握', { selector: 'span' })).toBeInTheDocument();
  service.getWrongBook.mockResolvedValue({ success: true, data: list([item('q1', true)], 1) });
  fireEvent.click(screen.getByRole('button', { name: '标记已掌握' })); await screen.findByRole('button', { name: '恢复未掌握' });
  fireEvent.click(screen.getByRole('button', { name: '恢复未掌握' }));
  await waitFor(() => expect(service.markMastered).toHaveBeenLastCalledWith('q1', false));
});

test('multi-choice and shuffled answers use snapshot labels and content for every selected option', () => {
  render(<QuestionSnapshot correctAnswer={['option-c', 'option-a']} question={item('q1').question} userAnswer={['option-c', 'option-b']} />);
  const wrong = screen.getByRole('heading', { name: '当次错误答案' }).parentElement as HTMLElement;
  expect(within(wrong).getByText('A.')).toBeInTheDocument(); expect(within(wrong).getByText('C.')).toBeInTheDocument();
  expect(within(wrong).getByText('丙内容')).toBeInTheDocument(); expect(within(wrong).getByText('乙内容')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '正确答案' })).not.toBeInTheDocument();
  expect(screen.getByText('甲内容').closest('.border-green-400')).toBeInTheDocument();
  expect(screen.queryByText('正确选项')).not.toBeInTheDocument();
  expect(screen.queryByText('解析')).not.toBeInTheDocument();
  expect(screen.queryByText('解析内容')).not.toBeInTheDocument();
});

test('detail shows source history and missing snapshots, pages history, jumps via answer card and closes outside scroll', async () => {
  const { container } = render(<WrongBook />); await screen.findByText('题干 q1');
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 题详情' }));
  await screen.findByRole('table', { name: '历次错选答案' });
  expect(screen.getAllByRole('columnheader').map(node => node.textContent)).toEqual(['错误时间', '错选答案']);
  expect(screen.queryByText('考试 · 乱序考试')).not.toBeInTheDocument();
  expect(screen.getByText(/历史快照缺失/)).toBeInTheDocument();
  expect(screen.getByText(/另有 2 次旧错误/)).toBeInTheDocument();
  const exit = screen.getByRole('button', { name: '退出错题详情' });
  expect(container.querySelector('[data-question-scroll-container]')?.contains(exit)).toBe(false);
  fireEvent.click(within(screen.getByRole('navigation', { name: '错误记录分页' })).getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(service.getDetail).toHaveBeenLastCalledWith('q1', 2, 5, expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '第 2 题，错误' }));
  await waitFor(() => expect(service.getDetail).toHaveBeenLastCalledWith('q2', 1, 5, expect.any(AbortSignal)));
  fireEvent.click(exit); await screen.findByRole('heading', { name: '错题本', level: 1 });
});

test('selecting the current answer-card question keeps its detail and history visible', async () => {
  render(<WrongBook />); await screen.findByText('题干 q1');
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 题详情' }));
  await screen.findByRole('table', { name: '历次错选答案' });
  fireEvent.click(screen.getByRole('button', { name: '第 1 题，错误' }));
  expect(screen.getByRole('table', { name: '历次错选答案' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '当前题目与答案' })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('navigation', { name: '错误记录分页' })).getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(service.getDetail).toHaveBeenLastCalledWith('q1', 2, 5, expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '第 1 题，错误' }));
  await waitFor(() => expect(service.getDetail).toHaveBeenLastCalledWith('q1', 1, 5, expect.any(AbortSignal)));
  expect(await screen.findByRole('table', { name: '历次错选答案' })).toBeInTheDocument();
});

test('detail failure can retry while keeping the fixed close action available', async () => {
  service.getDetail.mockRejectedValueOnce(new Error('详情请求失败'));
  render(<WrongBook />); await screen.findByText('题干 q1'); fireEvent.click(screen.getByRole('button', { name: '查看第 1 题详情' }));
  await screen.findByText('详情请求失败'); expect(screen.getByRole('button', { name: '退出错题详情' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '重试详情' })); await screen.findByText('历次错误记录');
});

test('successful mastery removal from a filtered last page returns to a valid page', async () => {
  service.getWrongBook.mockResolvedValue({ success: true, data: list([item('q1')], 11) });
  render(<WrongBook />); await screen.findByText('共 11 道错题');
  fireEvent.click(within(screen.getByRole('navigation', { name: '错题列表分页' })).getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(service.getWrongBook).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal)));
  service.getWrongBook.mockImplementation(async params => ({ success: true, data: list(params?.page === 2 ? [] : [item('q2')], 10) }));
  fireEvent.click(screen.getByRole('button', { name: '标记已掌握' }));
  await screen.findByText('题干 q2');
  expect(service.getWrongBook).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.any(AbortSignal));
});

test('backfill requires preview and confirmation, then refreshes on success', async () => {
  const onChange = jest.fn();
  service.previewBackfill.mockResolvedValue({ success: true, data: { completedSources: 2, excludedSources: 1, newQuestions: 1, newOccurrences: 2, skipped: 3, alreadyRecorded: 2, anomalies: 1, snapshotMissing: 2, rows: [{ sourceType: 'exam', sourceSessionId: 'missing-time', questionId: 'q1', disposition: 'error', reason: '历史考试缺少提交时间。', snapshotMissing: false }], previewToken: 'test-preview', expiresInSeconds: 900 } });
  service.executeBackfill.mockResolvedValue({ success: true, data: { added: 2, newQuestions: 1, skipped: 3, anomalies: 1, snapshotMissing: 2, failed: 0, replayed: false } });
  render(<WrongBookMaintenance onChange={onChange} />);
  fireEvent.click(screen.getByText('历史错题补录')); fireEvent.click(screen.getByRole('button', { name: '生成只读预览' }));
  await screen.findByRole('region', { name: '历史补录预览' });
  expect(screen.queryByText('异常记录')).not.toBeInTheDocument();
  expect(screen.queryByText(/历史考试缺少提交时间/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '确认执行补录' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: '确认执行补录' }));
  await screen.findByText('补录完成：新增 2 条错误记录，跳过 4 条。'); expect(service.executeBackfill).toHaveBeenCalledWith('test-preview'); expect(onChange).toHaveBeenCalledTimes(1);
});

test('pending collection retry and its failure remain visible with no lost completion state', async () => {
  service.getCollectionJobs.mockResolvedValue({ success: true, data: { total: 1, jobs: [{ id: 'job', sourceType: 'exam', sourceSessionId: 'exam-1', status: 'pending', attempts: 1, lastError: '提交已保存', createdAt: '2026-10-21T09:00:00Z', completedAt: null }] } });
  service.retryCollection.mockResolvedValue({ success: true, data: { jobId: 'job', status: 'pending', message: '收录仍未完成' } });
  render(<WrongBookMaintenance onChange={jest.fn()} />); await screen.findByText('考试 · exam-1');
  fireEvent.click(screen.getByRole('button', { name: '重试收录' })); await screen.findByText('收录仍未完成');
  expect(screen.getByText('考试 · exam-1')).toBeInTheDocument(); expect(service.retryCollection).toHaveBeenCalledWith('job');
});

test('history table shows only letters mapped to the current full options despite exam shuffling', async () => {
  const data = detail();
  data.occurrences[0].question = { ...data.item.question, options: [
    { id: 'option-b', content: '乙内容', displayLabel: 'A' },
    { id: 'option-c', content: '丙内容', displayLabel: 'B' },
    { id: 'option-a', content: '甲内容', displayLabel: 'C' },
  ] };
  service.getDetail.mockResolvedValue({ success: true, data });
  render(<WrongBook />); await screen.findByText('题干 q1');
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 题详情' }));
  const table = await screen.findByRole('table', { name: '历次错选答案' });
  expect(within(table).getByText('A、C')).toBeInTheDocument();
  expect(within(table).queryByText('乙内容')).not.toBeInTheDocument();
  expect(within(table).queryByText('丙内容')).not.toBeInTheDocument();
  expect(within(table).queryByText('option-b')).not.toBeInTheDocument();
});

test('fill questions retain the correct answer because they have no option highlights', () => {
  render(<QuestionSnapshot question={{ ...item('fill').question, type: 'fill', options: [], answer: '50' }} />);
  expect(screen.getByRole('heading', { name: '正确答案' })).toBeInTheDocument();
  expect(screen.getByText('50')).toBeInTheDocument();
});
