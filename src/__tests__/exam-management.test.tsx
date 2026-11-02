import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ExamManagement from '../pages/admin/ExamManagement';
import { examService } from '../services/examService';
import { questionService } from '../services/questionService';

jest.mock('../services/examService', () => ({ examService: { getAllExams: jest.fn(), deleteExam: jest.fn(), archiveExam: jest.fn(), restoreExam: jest.fn(), createExam: jest.fn(), updateExam: jest.fn() } }));
jest.mock('../services/questionService', () => ({ questionService: { getTopics: jest.fn() } }));

let exams: any[];
beforeEach(() => {
  jest.clearAllMocks();
  exams = [
    { id: 'active', name: '当前考试', description: '', duration: 60, rules: [], isActive: true, status: 'published' },
    { id: 'archived', name: '历史考试', description: '', duration: 60, rules: [], isActive: false, status: 'archived' },
  ];
  window.confirm = jest.fn(() => true);
  window.alert = jest.fn();
  (questionService.getTopics as jest.Mock).mockResolvedValue({ success: true, data: [] });
  (examService.getAllExams as jest.Mock).mockImplementation(async ({ status }: any) => {
    const filtered = status === 'archived' ? exams.filter(exam => exam.status === 'archived') : [...exams];
    return { data: { exams: filtered, total: filtered.length } };
  });
  (examService.archiveExam as jest.Mock).mockImplementation(async id => {
    exams = exams.map(exam => exam.id === id ? { ...exam, status: 'archived', isActive: false } : exam);
    return { success: true };
  });
  (examService.restoreExam as jest.Mock).mockImplementation(async id => {
    exams = exams.map(exam => exam.id === id ? { ...exam, status: 'draft', isActive: true } : exam);
    return { success: true };
  });
  (examService.deleteExam as jest.Mock).mockImplementation(async id => { exams = exams.filter(exam => exam.id !== id); });
});
afterEach(cleanup);

test('unarchived filter retains existing draft/published exams and hides archived exams without a new backend filter value', async () => {
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  expect(screen.queryByText('历史考试')).not.toBeInTheDocument();
  expect(examService.getAllExams).toHaveBeenCalledWith({ page: 1, limit: 100 }, true);
  fireEvent.change(screen.getByLabelText('归档筛选'), { target: { value: 'archived' } });
  await screen.findByText('历史考试');
  expect(screen.queryByText('当前考试')).not.toBeInTheDocument();
  expect(screen.getByTitle('恢复为草稿后可编辑')).toBeDisabled();
  expect(screen.queryByTitle('发布')).not.toBeInTheDocument();
});

test('archive action is icon-only, keeps records, and moves the exam into the archived view', async () => {
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  const archive = screen.getByRole('button', { name: '归档' });
  expect(archive.textContent).toBe('');
  fireEvent.click(archive);
  await screen.findByText('考试已归档，已有成绩和答题记录已保留。');
  expect(examService.archiveExam).toHaveBeenCalledWith('active');
  expect(examService.deleteExam).not.toHaveBeenCalled();
  expect(screen.queryByText('当前考试')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('归档筛选'), { target: { value: 'archived' } });
  await screen.findByText('当前考试');
});

test('restoring an archived exam returns it to an unpublished draft', async () => {
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  fireEvent.change(screen.getByLabelText('归档筛选'), { target: { value: 'archived' } });
  await screen.findByText('历史考试');
  fireEvent.click(screen.getByRole('button', { name: '恢复为草稿' }));
  await screen.findByText('考试已恢复为草稿，发布后可重新参加。');
  expect(examService.restoreExam).toHaveBeenCalledWith('archived');
  fireEvent.change(screen.getByLabelText('归档筛选'), { target: { value: 'unarchived' } });
  const restored = (await screen.findByText('历史考试')).closest('tr')!;
  expect(within(restored).getByTitle('发布')).toBeEnabled();
});

test('permanent deletion names the associated records and respects cancel', async () => {
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  (window.confirm as jest.Mock).mockReturnValueOnce(false);
  fireEvent.click(screen.getByTitle('删除'));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/全部考试记录、成绩、作答内容和试卷记录将一并删除，无法恢复/));
  expect(examService.deleteExam).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTitle('删除'));
  await screen.findByText('考试及其关联记录已全部删除。');
  expect(examService.deleteExam).toHaveBeenCalledWith('active');
  expect(screen.queryByText('当前考试')).not.toBeInTheDocument();
});

test('failed deletion shows the error and leaves the exam visible for retry', async () => {
  (examService.deleteExam as jest.Mock).mockRejectedValueOnce(new Error('删除考试失败，考试及关联记录未删除，请重试。'));
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  fireEvent.click(screen.getByTitle('删除'));
  expect(await screen.findByRole('alert')).toHaveTextContent('考试及关联记录未删除');
  expect(screen.getByText('当前考试')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTitle('删除')).toBeEnabled());
});

test('a late archived-list response cannot replace a newer all-exams response', async () => {
  let finishArchived: (value: unknown) => void;
  const defaultList = (examService.getAllExams as jest.Mock).getMockImplementation()!;
  (examService.getAllExams as jest.Mock).mockImplementation((params: any) => params.status === 'archived'
    ? new Promise(resolve => { finishArchived = resolve; }) : defaultList(params));
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  fireEvent.change(screen.getByLabelText('归档筛选'), { target: { value: 'archived' } });
  fireEvent.change(screen.getByLabelText('归档筛选'), { target: { value: 'all' } });
  await screen.findByText('历史考试');
  await act(async () => finishArchived!({ data: { exams: [exams[1]], total: 1 } }));
  expect(screen.getByText('当前考试')).toBeInTheDocument();
  expect(screen.getByText('历史考试')).toBeInTheDocument();
});

const courseTopics = [{ id: 'course', name: '毛概' }, { id: 'chapter1', name: '第一章', parentId: 'course' }, { id: 'chapter2', name: '第二章', parentId: 'course' }];

test('new exam labels quantity and score, adds a different question type, and saves the correct course-level quantities', async () => {
  (questionService.getTopics as jest.Mock).mockResolvedValue({ success: true, data: courseTopics });
  (examService.createExam as jest.Mock).mockResolvedValue({ data: {} });
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  fireEvent.click(screen.getByRole('button', { name: '新建考试' }));
  const dialog = screen.getByRole('dialog', { name: '新建考试' });
  fireEvent.change(within(dialog).getByLabelText('考试名称'), { target: { value: '毛概全部小题' } });
  fireEvent.change(within(dialog).getByLabelText('考试描述'), { target: { value: '全部小题' } });
  fireEvent.change(within(dialog).getByLabelText('规则1课程'), { target: { value: 'course' } });
  fireEvent.change(within(dialog).getByLabelText('规则1题型1抽题数量'), { target: { value: '197' } });
  fireEvent.change(within(dialog).getByLabelText('规则1题型1每题分值'), { target: { value: '1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '+ 添加题型' }));
  expect(within(dialog).getByLabelText('规则1题型2')).toHaveValue('multiple');
  fireEvent.change(within(dialog).getByLabelText('规则1题型2抽题数量'), { target: { value: '101' } });
  fireEvent.change(within(dialog).getByLabelText('规则1题型2每题分值'), { target: { value: '1' } });
  expect(within(dialog).getByText(/合计\s*298\s*题，\s*总分\s*298\s*分/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: /^保存$/ }));
  await waitFor(() => expect(examService.createExam).toHaveBeenCalledWith(expect.objectContaining({ rules: [{ subjectId: 'course', chapterIds: [], questionTypes: [{ type: 'single', count: 197, score: 1 }, { type: 'multiple', count: 101, score: 1 }] }] })));
});

test('edit uses one grouped course rule and preserves its chapter scope; failed update never creates a duplicate exam', async () => {
  (questionService.getTopics as jest.Mock).mockResolvedValue({ success: true, data: courseTopics });
  exams[0] = { ...exams[0], description: '描述', rules: [{ topicId: 'chapter1', topicIds: ['chapter1', 'chapter2'], subjectId: 'course', questionTypes: [{ type: 'single', count: 30, score: 2 }, { type: 'multiple', count: 20, score: 2 }] }] };
  (examService.updateExam as jest.Mock).mockRejectedValueOnce(new Error('保存失败'));
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  fireEvent.click(screen.getByTitle('编辑'));
  const dialog = screen.getByRole('dialog', { name: '编辑考试' });
  expect(within(dialog).getByLabelText('规则1课程')).toHaveValue('course');
  expect(within(dialog).queryByLabelText('规则2课程')).not.toBeInTheDocument();
  expect(within(dialog).getByText(/合计\s*50\s*题，\s*总分\s*100\s*分/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: /^保存$/ }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('保存失败: 保存失败'));
  expect(examService.updateExam).toHaveBeenCalledWith('active', expect.objectContaining({ status: 'published', rules: [expect.objectContaining({ chapterIds: ['chapter1', 'chapter2'] })] }));
  expect(examService.createExam).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: '编辑考试' })).toBeInTheDocument();
});

test('question counts and per-question scores normalize leading zeros while typing', async () => {
  render(<ExamManagement />);
  await screen.findByText('当前考试');
  fireEvent.click(screen.getByRole('button', { name: '新建考试' }));
  const count = screen.getByLabelText('规则1题型1抽题数量');
  const score = screen.getByLabelText('规则1题型1每题分值');
  fireEvent.change(count, { target: { value: '030' } });
  fireEvent.change(score, { target: { value: '003' } });
  expect(count).toHaveValue('30');
  expect(score).toHaveValue('3');
});
