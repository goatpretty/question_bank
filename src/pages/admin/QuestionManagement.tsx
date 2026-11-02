import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit, Trash2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { questionService } from '../../services/questionService';
import { Question, QuestionType, Topic, CreateQuestionData } from '../../../shared/types';
import MathRenderer from '../../components/MathRenderer';
import QuestionFormModal from '../../components/question/QuestionFormModal';
import { createPortal } from 'react-dom';

const PAGE_SIZE = 20;

export default function QuestionManagement() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const subjects = topics.filter(t => !t.parentId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState<CreateQuestionData>({
    topicId: '',
    type: 'single',
    content: '',
    options: [],
    answer: '',
    analysis: '',
    difficulty: 1,
    score: 5,
    tags: [],
  });
  const [manageTopicOpen, setManageTopicOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newChapterName, setNewChapterName] = useState('');
  const [importRows, setImportRows] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const hasInitialLoadRef = useRef(false);

  const questionTypes = [
    { value: 'single', label: '单选题' },
    { value: 'multiple', label: '多选题' },
    { value: 'fill', label: '填空题' },
    { value: 'subjective', label: '主观题' },
  ];

  const fetchQuestions = useCallback(async () => {
    if (!selectedSubjectId) {
      setQuestions([]);
      setTotal(0);
      setTotalPages(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_SIZE,
        subjectId: selectedSubjectId,
      };
      if (selectedChapterId) {
        params.topicId = selectedChapterId;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (searchTerm.trim()) {
        params.keyword = searchTerm.trim();
      }

      const response = await questionService.getAllQuestions(params);
      setQuestions(response.data.questions);
      setTotal(response.data.total);
      setPage(response.data.page);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('获取题目列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, selectedChapterId, typeFilter, searchTerm, page]);

  useEffect(() => {
    fetchTopics();
  }, []);

  useEffect(() => {
    if (!hasInitialLoadRef.current && topics.length > 0) {
      hasInitialLoadRef.current = true;
      setLoading(false);
    }
  }, [topics]);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchQuestions();
    } else {
      setQuestions([]);
      setTotal(0);
      setTotalPages(0);
    }
  }, [selectedSubjectId, selectedChapterId, typeFilter, searchTerm, page]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.querySelector('.relative.inline-block') as HTMLElement;
      if (dropdown && !dropdown.contains(event.target as Node) && showTemplateMenu) {
        setShowTemplateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTemplateMenu]);

  const fetchTopics = async () => {
    try {
      const response = await questionService.getTopics();
      setTopics(response.data ?? []);
    } catch (error) {
      console.error('获取章节列表失败:', error);
    }
  };

  const createSubject = async () => {
    if (!newSubjectName.trim()) return;
    try {
      const data = await questionService.createTopic({ name: newSubjectName });
      setTopics(prev => [...prev, data.data]);
      setNewSubjectName('');
    } catch (e) {
      console.error('新增科目失败:', e);
    }
  };

  const createChapter = async () => {
    if (!newChapterName.trim() || !selectedSubjectId) return;
    try {
      const data = await questionService.createTopic({ name: newChapterName, parentId: selectedSubjectId });
      setTopics(prev => [...prev, data.data]);
      setNewChapterName('');
    } catch (e) {
      console.error('新增章节失败:', e);
    }
  };

  const deleteTopic = async (id: string) => {
    try {
      const confirmMsg = '删除将同时删除该科目/章节下的所有题目，且不可恢复。是否继续？';
      if (!confirm(confirmMsg)) return;
      await questionService.deleteTopic(id);
      setTopics(prev => prev.filter(t => t.id !== id && t.parentId !== id));
      if (selectedSubjectId === id || selectedChapterId === id) {
        setSelectedSubjectId('');
        setSelectedChapterId('');
      }
      await fetchQuestions();
      alert('已删除标签及关联题目');
    } catch (e) {
      console.error('删除标签失败:', e);
    }
  };

  const handleDownloadTemplate = async (format: 'xlsx' | 'json') => {
    try {
      const blob = await questionService.downloadImportTemplate(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShowTemplateMenu(false);
    } catch (e) {
      console.error('下载模板失败:', e);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.json')) {
      alert('不支持的文件类型，请选择Excel(.xlsx,.xls)或JSON(.json)文件');
      e.target.value = '';
      return;
    }
    if (!confirm('请确认已提前创建课程与章节，且模板中的课程章节名称与系统一致。继续导入？')) {
      e.target.value = '';
      return;
    }
    try {
      const data = await questionService.previewImport(file);
      if (!data.success) {
        alert(data.error || '预览失败');
      } else {
        setImportRows(data.data?.rows || []);
        setShowImportModal(true);
      }
    } catch (err) {
      console.error('预览失败:', err);
      alert(`预览失败: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleCommitImport = async () => {
    try {
      const data = await questionService.commitImport({ rows: importRows });
      if (!data.success) {
        alert(data.error || '提交失败');
      } else {
        alert(`导入完成：成功 ${data.data?.imported || 0} 条，错误 ${data.data?.errors?.length || 0} 条`);
        setShowImportModal(false);
        setImportRows([]);
        fetchQuestions();
      }
    } catch (err) {
      console.error('提交失败:', err);
      alert('提交失败');
    }
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedChapterId('');
    setPage(1);
  };

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setPage(1);
  };

  const handleTypeFilterChange = (type: QuestionType | 'all') => {
    setTypeFilter(type);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCreate = () => {
    setEditingQuestion(null);
    setFormData({
      topicId: '',
      type: 'single',
      content: '',
      options: [],
      answer: '',
      analysis: '',
      score: 5,
      tags: [],
    });
    setShowModal(true);
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      topicId: question.topicId,
      type: question.type,
      content: question.content,
      options: question.options || [],
      answer: Array.isArray(question.answer) ? question.answer.join('') : question.answer,
      analysis: question.analysis || '',
      score: question.score,
      tags: question.tags || [],
    });
    const ch = topics.find(t => t.id === question.topicId);
    if (ch?.parentId) {
      setSelectedSubjectId(ch.parentId);
    }
    setSelectedChapterId(question.topicId);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这道题目吗？')) {
      try {
        await questionService.deleteQuestion(id);
        setQuestions(prev => prev.filter(q => q.id !== id));
        if (questions.length === 1 && page > 1) {
          setPage(prev => prev - 1);
        } else {
          fetchQuestions();
        }
        alert('删除成功');
      } catch (error) {
        const msg = (error as Error).message || '';
        if (msg.includes('无权限') || msg.includes('Insufficient permissions') || msg.includes('Access denied')) {
          alert('无权限删除题目。');
        } else if (msg.includes('题目不存在') || msg.includes('not found')) {
          alert('题目不存在或已被删除。');
        } else if (msg.includes('已被') || msg.includes('引用') || msg.includes('referenced')) {
          alert('该题目已被考试、练习或错题记录引用，不能直接删除。');
        } else {
          alert(msg || '删除失败');
        }
        console.error('[DELETE FAILED]', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjectId = selectedSubjectId || formData.topicId;
    if (!subjectId || !selectedChapterId) {
      alert('请先选择科目与章节');
      return;
    }
    try {
      if (editingQuestion) {
        await questionService.updateQuestion(editingQuestion.id, { ...formData, topicId: selectedChapterId });
      } else {
        await questionService.createQuestion({ ...formData, topicId: selectedChapterId });
      }
      setShowModal(false);
      fetchQuestions();
    } catch (error) {
      console.error('保存题目失败:', error);
    }
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

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">题库管理</h1>
        <div className="flex gap-2">
          <div className="relative inline-block">
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              title="下载模板（先创建课程与章节）"
            >
              下载模板
              <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showTemplateMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showTemplateMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                <button onClick={() => handleDownloadTemplate('xlsx')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Excel模板 (.xlsx)</button>
                <button onClick={() => handleDownloadTemplate('json')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">JSON模板 (.json)</button>
              </div>
            )}
          </div>

          <label className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
            批量导入
            <input type="file" accept=".xlsx,.xls,.json" hidden onChange={handleImportFile} />
          </label>
          <button
            onClick={handleCreate}
            className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建题目
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索题目内容或标签..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <select
            value={selectedSubjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="">请选择科目</option>
            {subjects.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
          <select
            value={selectedChapterId}
            onChange={(e) => handleChapterChange(e.target.value)}
            disabled={!selectedSubjectId}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">所有章节</option>
            {topics.filter(t => t.parentId === selectedSubjectId).map(topic => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => handleTypeFilterChange(e.target.value as QuestionType | 'all')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="all">所有题型</option>
            {questionTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedSubjectId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow text-center py-16 text-gray-500 dark:text-gray-400">
          请先选择科目
        </div>
      )}

      {selectedSubjectId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">题目内容</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">题型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">章节</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">分数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">标签</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {questions.map((question) => (
                  <tr key={question.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{question.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <div className="max-w-xs truncate" title={question.content}>
                        <MathRenderer content={question.content} />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                        {getTypeLabel(question.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {topics.find(t => t.id === question.topicId)?.name || '未知章节'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{question.score}分</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <div className="max-w-xs truncate" title={question.tags.join(', ')}>{question.tags.join(', ')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button onClick={() => handleEdit(question)} className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors" title="编辑">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(question.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors" title="删除">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {questions.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">暂无题目数据</div>
          )}

          {totalPages > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-700 dark:text-gray-300">共 {total} 条记录，第 {page} / {totalPages} 页</div>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <QuestionFormModal
         show={showModal}
         onClose={() => setShowModal(false)}
         editingQuestion={editingQuestion}
         formData={formData}
         setFormData={setFormData}
         selectedSubjectId={selectedSubjectId}
         setSelectedSubjectId={setSelectedSubjectId}
         selectedChapterId={selectedChapterId}
         setSelectedChapterId={setSelectedChapterId}
         topics={topics}
         onSubmit={handleSubmit}
         onManageTopic={() => setManageTopicOpen(true)}
       />

      {manageTopicOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setManageTopicOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">管理科目与章节</h3>
              <button onClick={() => setManageTopicOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新增科目</label>
                <div className="flex gap-2">
                  <input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded" placeholder="科目名称" />
                  <button type="button" onClick={createSubject} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">添加科目</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新增章节</label>
                <div className="flex gap-2">
                  <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded">
                    <option value="">选择科目</option>
                    {subjects.map(sub => (<option key={sub.id} value={sub.id}>{sub.name}</option>))}
                  </select>
                  <input value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded" placeholder="章节名称" />
                  <button type="button" onClick={createChapter} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">添加章节</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">科目列表</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {subjects.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700">
                        <span className="text-gray-700 dark:text-gray-300">{sub.name}</span>
                        <button onClick={() => deleteTopic(sub.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">删除</button>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedSubjectId && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">章节列表</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {topics.filter(t => t.parentId === selectedSubjectId).map(ch => (
                        <div key={ch.id} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700">
                          <span className="text-gray-700 dark:text-gray-300">{ch.name}</span>
                          <button onClick={() => deleteTopic(ch.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">删除</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showImportModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">导入预览与补全</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">序号</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">题型</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">题干</th>
                      {(() => {
                        const allCols = new Set<string>();
                        for (const r of importRows) {
                          if (Array.isArray(r.optionCols)) {
                            r.optionCols.forEach((c: string) => allCols.add(c));
                          }
                          if (r.options && Array.isArray(r.options)) {
                            r.options.forEach((o: any) => { if (o.id) allCols.add(o.id); });
                          }
                          if (r.A !== undefined) allCols.add('A');
                          if (r.B !== undefined) allCols.add('B');
                          if (r.C !== undefined) allCols.add('C');
                          if (r.D !== undefined) allCols.add('D');
                        }
                        const sortedCols = Array.from(allCols).sort();
                        return sortedCols.map(col => (
                          <th key={col} className="py-2 pr-4 text-gray-700 dark:text-gray-300">{col}</th>
                        ));
                      })()}
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">答案</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">解析</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">课程</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">章节</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">标签</th>
                      <th className="py-2 pr-4 text-gray-700 dark:text-gray-300">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, idx) => (
                      <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="py-2 pr-2 w-16 text-gray-700 dark:text-gray-300">{r.seq}</td>
                        <td className="py-2 pr-2 w-24"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={r.type} onChange={e => { const rows=[...importRows]; rows[idx].type=e.target.value; setImportRows(rows); }} /></td>
                        <td className="py-2 pr-2 w-64"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={r.stem} onChange={e => { const rows=[...importRows]; rows[idx].stem=e.target.value; setImportRows(rows); }} /></td>
                        {(() => {
                          const allCols = new Set<string>();
                          for (const row of importRows) {
                            if (Array.isArray(row.optionCols)) {
                              row.optionCols.forEach((c: string) => allCols.add(c));
                            }
                            if (row.options && Array.isArray(row.options)) {
                              row.options.forEach((o: any) => { if (o.id) allCols.add(o.id); });
                            }
                            if (row.A !== undefined) allCols.add('A');
                            if (row.B !== undefined) allCols.add('B');
                            if (row.C !== undefined) allCols.add('C');
                            if (row.D !== undefined) allCols.add('D');
                          }
                          const sortedCols = Array.from(allCols).sort();
                          return sortedCols.map(col => {
                            const cellValue = r[col] !== undefined ? r[col] : (r.options?.find((o: any) => o.id === col)?.content || '');
                            return (
                              <td key={col} className="py-2 pr-2 w-40"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={cellValue} onChange={e => {
                                const rows = [...importRows];
                                rows[idx][col] = e.target.value;
                                if (Array.isArray(rows[idx].options)) {
                                  const optIdx = rows[idx].options.findIndex((o: any) => o.id === col);
                                  if (optIdx >= 0) {
                                    rows[idx].options[optIdx].content = e.target.value;
                                  }
                                }
                                setImportRows(rows);
                              }} /></td>
                            );
                          });
                        })()}
                        <td className="py-2 pr-2 w-32"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={r.answer} onChange={e => { const rows=[...importRows]; rows[idx].answer=e.target.value; setImportRows(rows); }} placeholder="多选可填ABC" /></td>
                        <td className="py-2 pr-2 w-56"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={r.analysis} onChange={e => { const rows=[...importRows]; rows[idx].analysis=e.target.value; setImportRows(rows); }} /></td>
                        <td className="py-2 pr-2 w-40"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={r.course} onChange={e => { const rows=[...importRows]; rows[idx].course=e.target.value; setImportRows(rows); }} /></td>
                        <td className="py-2 pr-2 w-40"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={r.chapter} onChange={e => { const rows=[...importRows]; rows[idx].chapter=e.target.value; setImportRows(rows); }} /></td>
                        <td className="py-2 pr-2 w-40"><input className="form-input bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded" value={r.tags || ''} onChange={e => { const rows=[...importRows]; rows[idx].tags=e.target.value; setImportRows(rows); }} /></td>
                        <td className="py-2 pr-2 w-48">{(r.errors||[]).length ? (<span className="text-red-600 dark:text-red-400 text-xs">{r.errors.join(', ')}</span>) : (<span className="text-green-600 dark:text-green-400 text-xs">已就绪</span>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3 bg-white dark:bg-gray-800">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button onClick={handleCommitImport} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">完成导入</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
