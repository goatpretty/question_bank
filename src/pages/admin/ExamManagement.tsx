import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Search, Eye, Save, X, BarChart3, Archive, RotateCcw } from 'lucide-react';
import { examService } from '../../services/examService';
import { questionService } from '../../services/questionService';
import { Exam, QuestionType, Topic } from '../../../shared/types';

export default function ExamManagement() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'unarchived' | 'archived' | 'all'>('unarchived');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [savingExam, setSavingExam] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 60,
    rules: [{
      subjectId: '',
      chapterIds: [] as string[],
      questionTypes: [{
        type: 'single' as QuestionType,
        count: 5,
        score: 2,
      }],
    }],
    isActive: true,
  });
  const [topics, setTopics] = useState<Topic[]>([]);
  const subjects = topics.filter(t => !t.parentId);
  const [chapterCountById, setChapterCountById] = useState<Record<string, number>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const listRequest = useRef(0);

  const questionTypes = [
    { value: 'single', label: '单选题' },
    { value: 'multiple', label: '多选题' },
    { value: 'fill', label: '填空题' },
    { value: 'subjective', label: '主观题' },
  ];

  const fetchTopics = async () => {
    try {
      const data = await questionService.getTopics();
      if (data.success) setTopics(data.data);
    } catch (e) {
      console.error('获取章节失败:', e);
    }
  };

  const fetchChapterCount = async (chapterId: string) => {
    try {
      const data = await questionService.getAllQuestions({ topicId: chapterId, page: 1, limit: 1 });
      const total = data?.data?.total ?? 0;
      setChapterCountById(prev => ({ ...prev, [chapterId]: total }));
    } catch {
      setChapterCountById(prev => ({ ...prev, [chapterId]: 0 }));
    }
  };

  useEffect(() => {
    const ids = new Set<string>();
    formData.rules.forEach(r => (r.chapterIds || []).forEach(id => ids.add(id)));
    ids.forEach(id => {
      if (chapterCountById[id] === undefined) fetchChapterCount(id);
    });
  }, [formData.rules]);

  useEffect(() => {
    fetchExams();
  }, [archiveFilter]);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchExams = async () => {
    const requestId = ++listRequest.current;
    try {
      const results: Exam[] = [];
      let page = 1;
      let total = 0;
      do {
        const { data } = await examService.getAllExams({ page, limit: 100, ...(archiveFilter === 'archived' ? { status: 'archived' as const } : {}) }, true);
        results.push(...data.exams);
        total = data.total;
        if (!data.exams.length) break;
        page++;
      } while (results.length < total);
      if (requestId === listRequest.current) setExams(archiveFilter === 'unarchived' ? results.filter(exam => exam.status !== 'archived') : results);
    } catch (error) {
      console.error('获取考试列表失败:', error);
      if (requestId === listRequest.current) setActionNotice({ text: '考试列表加载失败，请重试。', error: true });
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchTerm) return exams;
    return exams.filter(exam =>
      (exam.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.description || '').toLowerCase().includes(searchTerm.toLowerCase()),
    );
  };

  const handleCreate = () => {
    setEditingExam(null);
    setFormData({
      name: '',
      description: '',
      duration: 60,
      rules: [{
        subjectId: '',
        chapterIds: [],
        questionTypes: [{
          type: 'single' as QuestionType,
          count: 5,
          score: 2,
        }],
      }],
      isActive: true,
    });
    setShowModal(true);
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      name: exam.name ?? '',
      description: exam.description ?? '',
      duration: typeof exam.duration === 'number' ? exam.duration : 60,
      rules: Array.isArray(exam.rules)
        ? exam.rules.map((rule: any) => ({
            subjectId: rule.subjectId || (topics.find(t => t.id === rule.topicId)?.parentId) || '',
            chapterIds: Array.isArray(rule.topicIds) ? rule.topicIds : [rule.topicId].filter(Boolean),
            questionTypes: Array.isArray(rule.questionTypes)
              ? rule.questionTypes.map((qt: any) => ({
                  type: qt.type as QuestionType,
                  count: qt.count ?? 0,
                  score: qt.score ?? 0,
                }))
              : [],
          }))
        : [{ subjectId: '', chapterIds: [], questionTypes: [{ type: 'single' as QuestionType, count: 5, score: 2 }] }],
      isActive: exam.isActive,
    });
    setShowModal(true);
  };

  const handleView = (exam: Exam) => {
    setSelectedExam(exam);
    setShowDetailModal(true);
  };

  const handleDelete = async (id: string) => {
    if (pendingActionId) return;
    const exam = exams.find(item => item.id === id);
    if (confirm(`确定永久删除考试“${exam?.name || id}”吗？\n该考试的全部考试记录、成绩、作答内容和试卷记录将一并删除，无法恢复。题库中的原题不会删除。`)) {
      setPendingActionId(id);
      try {
        await examService.deleteExam(id);
        setActionNotice({ text: '考试及其关联记录已全部删除。', error: false });
        await fetchExams();
      } catch (error) {
        console.error('删除考试失败:', error);
        setActionNotice({ text: error instanceof Error ? error.message : '删除失败，请重试。', error: true });
      } finally {
        setPendingActionId(null);
      }
    }
  };

  const handleArchive = async (exam: Exam) => {
    if (pendingActionId) return;
    const restoring = exam.status === 'archived';
    if (!restoring && !confirm(`确定归档考试“${exam.name}”吗？\n归档后不再允许新开考，已有成绩和答题记录保留，可随时恢复为草稿。`)) return;
    setPendingActionId(exam.id);
    try {
      const result = restoring ? await examService.restoreExam(exam.id) : await examService.archiveExam(exam.id);
      if (!result.success) throw new Error(result.error || '操作失败，请重试。');
      setActionNotice({ text: restoring ? '考试已恢复为草稿，发布后可重新参加。' : '考试已归档，已有成绩和答题记录已保留。', error: false });
      await fetchExams();
    } catch (error) {
      setActionNotice({ text: error instanceof Error ? error.message : '操作失败，请重试。', error: true });
    } finally {
      setPendingActionId(null);
    }
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ byType: Array<{ type: string; required: number; available: number }>; totalRequired: number; totalAvailable: number; warnings: string[] } | null>(null);

  const handlePreview = async (id: string) => {
    try {
      const data = await examService.getExamPreview(id);
      if (!data?.success) {
        alert(data?.error || '预览失败');
        return;
      }
      setPreviewData(data.data);
      setPreviewOpen(true);
    } catch (e) {
      console.error('预览试卷失败:', e);
      setActionNotice({ text: e instanceof Error ? e.message : '预览失败，请重试。', error: true });
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const data = await examService.publishExam(id);
      if (!data?.success) alert(data?.error || '发布失败');
      fetchExams();
    } catch (e) { console.error('发布考试失败:', e); }
  };

  const handleUnpublish = async (id: string) => {
    try {
      const data = await examService.unpublishExam(id);
      if (!data?.success) alert(data?.error || '取消发布失败');
      fetchExams();
    } catch (e) { console.error('取消发布考试失败:', e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingExam) return;
    if (new Set(formData.rules.map(rule => rule.subjectId)).size !== formData.rules.length) {
      alert('同一课程请在一条规则中配置所有题型，不能重复添加课程规则。');
      return;
    }
    for (const r of formData.rules) {
      if (!r.subjectId) {
        alert('请为每条规则选择科目');
        return;
      }
      if (!r.questionTypes.length || new Set(r.questionTypes.map(type => type.type)).size !== r.questionTypes.length) {
        alert('每条规则的题型不能重复，请检查单选题、多选题的选择。');
        return;
      }
      if (r.questionTypes.some(type => !Number.isInteger(type.count) || type.count < 1 || !Number.isInteger(type.score) || type.score < 1)) {
        alert('抽题数量和每题分值必须是大于 0 的整数。');
        return;
      }
    }
    const backendRules = formData.rules.map((r) => ({ subjectId: r.subjectId, chapterIds: r.chapterIds, questionTypes: r.questionTypes }));
    setSavingExam(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description ?? '',
        duration: formData.duration,
        rules: backendRules,
        isActive: formData.isActive,
        status: editingExam?.status || 'draft',
      };
      if (editingExam) {
        await examService.updateExam(editingExam.id, payload as any);
      } else {
        await examService.createExam(payload as any);
      }
      setShowModal(false);
      fetchExams();
    } catch (error) {
      console.error('保存考试失败:', error);
      alert(`保存失败: ${(error as Error).message || '未知错误'}`);
    } finally {
      setSavingExam(false);
    }
  };

  const addRule = () => {
    setFormData(prev => ({
      ...prev,
      rules: [...prev.rules, {
        subjectId: '',
        chapterIds: [],
        questionTypes: [{
          type: 'single' as QuestionType,
          count: 5,
          score: 2,
        }],
      }],
    }));
  };

  const removeRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const updateRule = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) => {
        if (i !== index) return rule;
        return { ...rule, [field]: value, ...(field === 'subjectId' ? { chapterIds: [] } : {}) } as any;
      }),
    }));
  };

  const addQuestionType = (ruleIndex: number) => {
    const unusedType = questionTypes.find(type => !formData.rules[ruleIndex].questionTypes.some(spec => spec.type === type.value));
    if (!unusedType) return;
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) =>
        i === ruleIndex ? {
          ...rule,
          questionTypes: [...rule.questionTypes, {
            type: unusedType.value as QuestionType,
            count: 5,
            score: 2,
          }],
        } : rule,
      ),
    }));
  };

  const removeQuestionType = (ruleIndex: number, typeIndex: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) =>
        i === ruleIndex ? {
          ...rule,
          questionTypes: rule.questionTypes.filter((_, ti) => ti !== typeIndex),
        } : rule,
      ),
    }));
  };

  const updateQuestionType = (ruleIndex: number, typeIndex: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) =>
        i === ruleIndex ? {
          ...rule,
          questionTypes: rule.questionTypes.map((qt, ti) =>
            ti === typeIndex ? { ...qt, [field]: value } : qt,
          ),
        } : rule,
      ),
    }));
  };

  const getTypeLabel = (type: QuestionType) => {
    const typeMap: Record<string, string> = {
      single: '单选题',
      multiple: '多选题',
      fill: '填空题',
      subjective: '主观题',
    };
    return typeMap[type];
  };

  const getTotalQuestions = (exam: Exam) => {
    const rules = Array.isArray(exam.rules) ? exam.rules : [];
    return rules.reduce((total, rule) =>
      total + (Array.isArray(rule.questionTypes) ? rule.questionTypes.reduce((sum, qt) => sum + (qt.count || 0), 0) : 0), 0,
    );
  };

  const getTotalScore = (exam: Exam) => {
    const rules = Array.isArray(exam.rules) ? exam.rules : [];
    return rules.reduce((total, rule) =>
      total + (Array.isArray(rule.questionTypes) ? rule.questionTypes.reduce((sum, qt) => sum + ((qt.count || 0) * (qt.score || 0)), 0) : 0), 0,
    );
  };

  const filteredExams = handleSearch();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">考试管理</h1>
        <button
          onClick={handleCreate}
          className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          新建考试
        </button>
      </div>

      {actionNotice && (
        <div role={actionNotice.error ? 'alert' : 'status'} className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${actionNotice.error
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
          : 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'}`}>
          <span>{actionNotice.text}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setActionNotice(null)} className="rounded p-1 hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <select aria-label="归档筛选" value={archiveFilter} onChange={event => setArchiveFilter(event.target.value as typeof archiveFilter)} disabled={!!pendingActionId}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
            <option value="unarchived">未归档考试</option>
            <option value="archived">已归档考试</option>
            <option value="all">全部考试</option>
          </select>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索考试名称或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">考试名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">描述</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">时长</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">题目数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">总分</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredExams.map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{exam.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <div className="font-medium">{exam.name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <div className="max-w-xs truncate" title={exam.description}>{exam.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{exam.duration}分钟</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{getTotalQuestions(exam)}题</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{getTotalScore(exam)}分</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      exam.status === 'archived'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        : exam.isActive
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>
                      {exam.status === 'archived' ? '已归档' : exam.isActive ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button onClick={() => handleView(exam)} className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors" title="查看详情">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button disabled={exam.status === 'archived' || !!pendingActionId} onClick={() => handleEdit(exam)} className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed" title={exam.status === 'archived' ? '恢复为草稿后可编辑' : '编辑'}>
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handlePreview(exam.id)} className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors" title="预览试卷">
                        <BarChart3 className="h-4 w-4" />
                      </button>
                      {exam.status !== 'archived' && (exam.status === 'published' ? (
                        <button disabled={!!pendingActionId} onClick={() => handleUnpublish(exam.id)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 transition-colors" title="取消发布">
                          <Save className="h-4 w-4" />
                        </button>
                      ) : (
                        <button disabled={!!pendingActionId} onClick={() => handlePublish(exam.id)} className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors" title="发布">
                          <Save className="h-4 w-4" />
                        </button>
                      ))}
                      <button type="button" aria-label={exam.status === 'archived' ? '恢复为草稿' : '归档'} disabled={!!pendingActionId} onClick={() => handleArchive(exam)} className="inline-flex items-center text-gray-600 hover:text-amber-700 dark:text-gray-300 dark:hover:text-amber-300 disabled:opacity-50 disabled:cursor-wait" title={exam.status === 'archived' ? '恢复为草稿' : '归档'}>
                        {exam.status === 'archived' ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </button>
                      <button disabled={!!pendingActionId} onClick={() => handleDelete(exam.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-wait" title="删除">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredExams.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">暂无考试数据</div>
        )}
      </div>

      {showModal && createPortal(
        <div role="dialog" aria-modal="true" aria-label={editingExam ? '编辑考试' : '新建考试'} className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{editingExam ? '编辑考试' : '新建考试'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">考试名称</label>
                    <input
                      type="text"
                      value={formData.name}
                      aria-label="考试名称"
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">考试时长（分钟）</label>
                    <input
                      type="number"
                      value={formData.duration}
                      aria-label="考试时长（分钟）"
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                      min="1"
                      max="300"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">考试描述</label>
                  <textarea
                    value={formData.description ?? ''}
                    aria-label="考试描述"
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))} className="mr-2" />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">启用考试</label>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">考试规则</label>
                    <button type="button" onClick={addRule} className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 text-sm">+ 添加规则</button>
                  </div>

                  {formData.rules.map((rule, ruleIndex) => (
                    <div key={ruleIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4 bg-white dark:bg-gray-800">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">规则 {ruleIndex + 1}</h4>
                        {formData.rules.length > 1 && (
                          <button type="button" onClick={() => removeRule(ruleIndex)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">科目</label>
                        <select
                          value={rule.subjectId || ''}
                          aria-label={`规则${ruleIndex + 1}课程`}
                          onChange={(e) => updateRule(ruleIndex, 'subjectId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                          required
                        >
                          <option value="">选择科目</option>
                          {subjects.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">抽题范围：{rule.chapterIds.length ? `已选 ${rule.chapterIds.length} 个章节` : '所选课程的全部章节'}</p>
                        <div className="flex justify-between items-center">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">题型设置</label>
                          <button type="button" disabled={new Set(rule.questionTypes.map(spec => spec.type)).size >= questionTypes.length} onClick={() => addQuestionType(ruleIndex)} className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed">+ 添加题型</button>
                        </div>

                        {rule.questionTypes.map((qt, typeIndex) => (
                          <div key={typeIndex} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                            <select
                              value={qt.type ?? 'single'}
                              aria-label={`规则${ruleIndex + 1}题型${typeIndex + 1}`}
                              onChange={(e) => updateQuestionType(ruleIndex, typeIndex, 'type', e.target.value)}
                              className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm"
                            >
                              {questionTypes.map(type => (
                                <option key={type.value} value={type.value} disabled={rule.questionTypes.some((spec, index) => index !== typeIndex && spec.type === type.value)}>{type.label}</option>
                              ))}
                            </select>

                            <span className="text-sm text-gray-600 dark:text-gray-300">抽取</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]+"
                              value={String(qt.count ?? 0)}
                              aria-label={`规则${ruleIndex + 1}题型${typeIndex + 1}抽题数量`}
                              onChange={(e) => { if (/^\d*$/.test(e.target.value)) updateQuestionType(ruleIndex, typeIndex, 'count', parseInt(e.target.value) || 0); }}
                              className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm"
                              placeholder="数量"
                              min="1"
                            />

                            <span className="text-sm text-gray-600 dark:text-gray-300">题，每题</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]+"
                              value={String(qt.score ?? 0)}
                              aria-label={`规则${ruleIndex + 1}题型${typeIndex + 1}每题分值`}
                              onChange={(e) => { if (/^\d*$/.test(e.target.value)) updateQuestionType(ruleIndex, typeIndex, 'score', parseInt(e.target.value) || 0); }}
                              className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm"
                              placeholder="分数"
                              min="1"
                            />

                            <span className="text-sm text-gray-500 dark:text-gray-400">分</span>

                            {rule.questionTypes.length > 1 && (
                              <button type="button" onClick={() => removeQuestionType(ruleIndex, typeIndex)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-gray-500 dark:text-gray-400">数量为这条规则范围内合计抽取的题数，不会按章节重复计算。</p>
                        {new Set(rule.questionTypes.map(spec => spec.type)).size !== rule.questionTypes.length && (
                          <p role="alert" className="text-sm text-red-600 dark:text-red-400">已有配置包含重复题型，请修正题型、抽题数量和每题分值后保存。</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  合计 {formData.rules.reduce((total, rule) => total + rule.questionTypes.reduce((sum, spec) => sum + spec.count, 0), 0)} 题，
                  总分 {formData.rules.reduce((total, rule) => total + rule.questionTypes.reduce((sum, spec) => sum + spec.count * spec.score, 0), 0)} 分
                </div>
              </form>
            </div>

            <div className="flex-shrink-0 flex justify-end space-x-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">取消</button>
              <button type="button" disabled={savingExam} onClick={() => formRef.current?.requestSubmit()} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-wait">
                <Save className="h-4 w-4 mr-2" />{savingExam ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {previewOpen && previewData && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">预览试卷题量与类型分布</h3>
              <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">题型</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">需求数量</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">可用数量</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.byType.map((r, idx) => (
                      <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{r.type === 'single' ? '单选题' : r.type === 'multiple' ? '多选题' : r.type === 'fill' ? '填空题' : '主观题'}</td>
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{r.required}</td>
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{r.available}</td>
                        <td className="py-2 pr-4">{r.available >= r.required ? <span className="text-green-600 dark:text-green-400">可用</span> : <span className="text-red-600 dark:text-red-400">不足</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm text-gray-700 dark:text-gray-300">总题量：{previewData.totalRequired}（可用：{previewData.totalAvailable}题）</div>
              {previewData.warnings.length > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded">
                  <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300">提示</div>
                  <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
                    {previewData.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showDetailModal && selectedExam && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">考试详情 - {selectedExam.name}</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">考试名称</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{selectedExam.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">考试时长</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{selectedExam.duration}分钟</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">描述</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedExam.description}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">状态</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedExam.isActive
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>
                      {selectedExam.isActive ? '启用' : '禁用'}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedExam.status === 'published'
                        ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                        : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                    }`}>
                      {selectedExam.status === 'published' ? '已发布' : '草稿'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">考试规则</label>
                  <div className="space-y-2">
                    {(Array.isArray(selectedExam.rules) ? selectedExam.rules : []).map((rule, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-600 rounded p-3 bg-white dark:bg-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          知识点: {rule.topicId}
                        </p>
                        <div className="space-y-1">
                          {(Array.isArray(rule.questionTypes) ? rule.questionTypes : []).map((qt, qtIndex) => (
                            <p key={qtIndex} className="text-sm text-gray-600 dark:text-gray-400">
                              {getTypeLabel(qt.type)}: {qt.count}题 × {qt.score}分 = {qt.count * qt.score}分
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">总题数</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{getTotalQuestions(selectedExam)}题</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">总分</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{getTotalScore(selectedExam)}分</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-end p-5 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">关闭</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
