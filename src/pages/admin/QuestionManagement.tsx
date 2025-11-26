import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Filter, Eye, Save, X } from 'lucide-react';
import { questionService } from '../../services/questionService';
import { authService } from '../../services/authService';
const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;
import { Question, QuestionType, Topic, CreateQuestionData, QuestionOption } from '../../../shared/types';
import MathRenderer from '../../components/MathRenderer';

export default function QuestionManagement() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const subjects = topics.filter(t => !t.parentId);
  const chapters = (subjectId: string | null | string) => topics.filter(t => t.parentId === (subjectId || null));
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
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
    tags: []
  });
  const [manageTopicOpen, setManageTopicOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newChapterName, setNewChapterName] = useState('');
  const [importRows, setImportRows] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);

  const questionTypes = [
    { value: 'single', label: '单选题' },
    { value: 'multiple', label: '多选题' },
    { value: 'fill', label: '填空题' },
    { value: 'subjective', label: '主观题' }
  ];

  useEffect(() => {
    fetchQuestions();
    fetchTopics();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await questionService.getAllQuestions();
      setQuestions(response.data.questions);
    } catch (error) {
      console.error('获取题目列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopics = async () => {
    try {
      const response = await fetch(`${API_HOST}/api/questions/topics`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`,
          'Content-Type': 'application/json'
        }
      });
      let data: any = { success: false, data: [] };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) setTopics(data.data);
    } catch (error) {
      console.error('获取章节列表失败:', error);
    }
  };

  const createSubject = async () => {
    if (!newSubjectName.trim()) return;
    try {
      const resp = await fetch(`${API_HOST}/api/questions/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`
        },
        body: JSON.stringify({ name: newSubjectName })
      });
      if (!resp.ok) {
        console.error('新增科目失败:', resp.status, resp.statusText);
        alert('新增科目失败');
        return;
      }
      const data = await resp.json();
      setTopics(prev => [...prev, data.data]);
      setNewSubjectName('');
    } catch (e) {
      console.error('新增科目失败:', e);
    }
  };

  const createChapter = async () => {
    if (!newChapterName.trim() || !selectedSubjectId) return;
    try {
      const resp = await fetch(`${API_HOST}/api/questions/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`
        },
        body: JSON.stringify({ name: newChapterName, parentId: selectedSubjectId })
      });
      if (!resp.ok) {
        console.error('新增章节失败:', resp.status, resp.statusText);
        alert('新增章节失败');
        return;
      }
      const data = await resp.json();
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
      const resp = await fetch(`${API_HOST}/api/questions/topics/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      if (!resp.ok) {
        console.error('删除标签失败:', resp.status, resp.statusText);
        alert('删除失败');
        return;
      }
      const data = await resp.json();
      setTopics(prev => prev.filter(t => t.id !== id && t.parentId !== id));
      // 刷新题目列表以反映被删除的题目
      await fetchQuestions();
      const removedCount = data?.data?.deletedQuestionCount ?? 0;
      alert(`已删除标签，并级联删除 ${removedCount} 道题目`);
    } catch (e) {
      console.error('删除标签失败:', e);
    }
  };

  const handleSearch = () => {
    let filtered = questions;
    
    if (searchTerm) {
      filtered = filtered.filter(q => 
        q.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(q => q.type === typeFilter);
    }
    
    if (topicFilter !== 'all') {
      filtered = filtered.filter(q => q.topicId === topicFilter);
    }
    
    return filtered;
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
      tags: []
    });
    setSelectedSubjectId('');
    setSelectedChapterId('');
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
      tags: question.tags || []
    });
    const ch = topics.find(t => t.id === question.topicId);
    setSelectedSubjectId(ch?.parentId || '');
    setSelectedChapterId(question.topicId);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这道题目吗？')) {
      try {
        await questionService.deleteQuestion(id);
        fetchQuestions();
      } catch (error) {
        console.error('删除题目失败:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedChapterId) {
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

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...(prev.options || []), { id: String.fromCharCode(65 + (prev.options?.length || 0)), content: '' }]
    }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: (prev.options || []).filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: (prev.options || []).map((opt, i) => i === index ? { ...opt, content: value } : opt)
    }));
  };

  const getTypeLabel = (type: QuestionType) => {
    const typeMap = {
      single: '单选题',
      multiple: '多选题',
      fill: '填空题',
      subjective: '主观题'
    };
    return typeMap[type];
  };

  const filteredQuestions = handleSearch();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">题库管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.open(`${API_HOST}/api/questions/import/template.xlsx`, '_blank')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            title="下载Excel模板（先创建课程与章节）"
          >
            下载模板
          </button>
          <label className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
            批量导入
            <input type="file" accept=".xlsx,.xls" hidden onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!confirm('请确认已提前创建课程与章节，且模板中的课程/章节名称与系统一致。继续导入？')) return;
              const fd = new FormData();
              fd.append('file', file);
              try {
                const resp = await fetch(`${API_HOST}/api/questions/import/preview`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` },
                  body: fd
                });
                const data = await resp.json();
                if (!resp.ok || !data?.success) {
                  alert(data?.error || '预览失败');
                } else {
                  setImportRows(data.data?.rows || []);
                  setShowImportModal(true);
                }
              } catch (err) {
                console.error('预览失败:', err);
                alert('预览失败');
              } finally {
                e.target.value = '';
              }
            }} />
          </label>
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建题目
          </button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索题目内容或标签..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as QuestionType | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有题型</option>
            {questionTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有章节</option>
            {topics.filter(t => !!t.parentId).map(topic => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 题目列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  题目内容
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  题型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  章节
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  标签
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredQuestions.map((question) => (
                <tr key={question.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {question.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate" title={question.content}>
                      <MathRenderer content={question.content} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getTypeLabel(question.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {topics.find(t => t.id === question.topicId)?.name || '未知章节'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {question.score}分
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate" title={question.tags.join(', ')}>
                      {question.tags.join(', ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(question)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="编辑"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(question.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredQuestions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            暂无题目数据
          </div>
        )}
      </div>

      {/* 编辑/创建模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl bg-white rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingQuestion ? '编辑题目' : '新建题目'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">题型</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as QuestionType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {questionTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">科目与章节</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => { setSelectedSubjectId(e.target.value); setSelectedChapterId(''); }}
                      className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">选择科目</option>
                      {subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">选择章节</option>
                      {chapters(selectedSubjectId).map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={() => setManageTopicOpen(true)} className="mt-2 text-sm text-blue-600">管理科目/章节</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题目内容
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {(formData.type === 'single' || formData.type === 'multiple') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    选项
                  </label>
                  {formData.options?.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-gray-500 w-8">{String.fromCharCode(65 + index)}.</span>
                      <input
                        type="text"
                        value={option.content}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                      />
                      {(formData.options?.length || 0) > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-blue-600 hover:text-blue-900 text-sm"
                  >
                    + 添加选项
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  正确答案
                </label>
                {formData.type === 'single' ? (
                  <select
                    value={Array.isArray(formData.answer) ? formData.answer[0] : formData.answer}
                    onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">请选择正确答案</option>
                    {formData.options?.map((option, index) => (
                      <option key={index} value={option.id}>
                        {option.id}. {option.content}
                      </option>
                    ))}
                  </select>
                ) : formData.type === 'multiple' ? (
                  <div>
                    {formData.options?.map((option, index) => (
                      <label key={index} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={Array.isArray(formData.answer) ? formData.answer.includes(option.id) : false}
                          onChange={(e) => {
                            const currentAnswers = Array.isArray(formData.answer) ? formData.answer : [];
                            const newAnswers = e.target.checked
                              ? [...currentAnswers, option.id].sort()
                              : currentAnswers.filter(ans => ans !== option.id);
                            setFormData(prev => ({ ...prev, answer: newAnswers }));
                          }}
                          className="mr-2"
                        />
                        {option.id}. {option.content}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={Array.isArray(formData.answer) ? formData.answer.join(', ') : formData.answer}
                    onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="请输入正确答案"
                    required
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    分数
                  </label>
                  <input
                    type="number"
                    value={formData.score}
                    onChange={(e) => setFormData(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签
                </label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入标签，用逗号分隔"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  解析
                </label>
                <textarea
                  value={formData.analysis}
                  onChange={(e) => setFormData(prev => ({ ...prev, analysis: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入题目解析（可选）"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 科目/章节管理入口 */}
      {manageTopicOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl bg-white rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">管理科目与章节</h3>
              <button onClick={() => setManageTopicOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新增科目</label>
                <div className="flex gap-2">
                  <input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} className="flex-1 px-3 py-2 border rounded" placeholder="科目名称" />
                  <button type="button" onClick={createSubject} className="px-4 py-2 bg-blue-600 text-white rounded">添加科目</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新增章节</label>
                <div className="flex gap-2">
                  <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className="px-3 py-2 border rounded">
                    <option value="">选择科目</option>
                    {subjects.map(sub => (<option key={sub.id} value={sub.id}>{sub.name}</option>))}
                  </select>
                  <input value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} className="flex-1 px-3 py-2 border rounded" placeholder="章节名称" />
                  <button type="button" onClick={createChapter} className="px-4 py-2 bg-blue-600 text-white rounded">添加章节</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">科目列表</h4>
                  <div className="space-y-2">
                    {subjects.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-2 border rounded">
                        <span>{sub.name}</span>
                        <button onClick={() => deleteTopic(sub.id)} className="text-red-600">删除</button>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedSubjectId && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">章节列表（选定科目）</h4>
                    <div className="space-y-2">
                      {chapters(selectedSubjectId).map(ch => (
                        <div key={ch.id} className="flex items-center justify-between p-2 border rounded">
                          <span>{ch.name}</span>
                          <button onClick={() => deleteTopic(ch.id)} className="text-red-600">删除</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-16 mx-auto p-5 border w-full max-w-6xl bg-white rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">导入预览与补全</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">序号</th>
                    <th className="py-2 pr-4">题型</th>
                    <th className="py-2 pr-4">题干</th>
                    <th className="py-2 pr-4">A</th>
                    <th className="py-2 pr-4">B</th>
                    <th className="py-2 pr-4">C</th>
                    <th className="py-2 pr-4">D</th>
                    <th className="py-2 pr-4">答案</th>
                    <th className="py-2 pr-4">解析</th>
                    <th className="py-2 pr-4">课程</th>
                    <th className="py-2 pr-4">章节</th>
                    <th className="py-2 pr-4">标签</th>
                    <th className="py-2 pr-4">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((r, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2 pr-2 w-16">{r.seq}</td>
                      <td className="py-2 pr-2 w-24"><input className="form-input" value={r.type} onChange={e => { const rows=[...importRows]; rows[idx].type=e.target.value; setImportRows(rows); }} /></td>
                      <td className="py-2 pr-2 w-64"><input className="form-input" value={r.stem} onChange={e => { const rows=[...importRows]; rows[idx].stem=e.target.value; setImportRows(rows); }} /></td>
                      {['A','B','C','D'].map(k => (
                        <td key={k} className="py-2 pr-2 w-40"><input className="form-input" value={r[k]} onChange={e => { const rows=[...importRows]; rows[idx][k]=e.target.value; setImportRows(rows); }} /></td>
                      ))}
                      <td className="py-2 pr-2 w-32"><input className="form-input" value={r.answer} onChange={e => { const rows=[...importRows]; rows[idx].answer=e.target.value; setImportRows(rows); }} placeholder="多选可填ABC" /></td>
                      <td className="py-2 pr-2 w-56"><input className="form-input" value={r.analysis} onChange={e => { const rows=[...importRows]; rows[idx].analysis=e.target.value; setImportRows(rows); }} /></td>
                      <td className="py-2 pr-2 w-40"><input className="form-input" value={r.course} onChange={e => { const rows=[...importRows]; rows[idx].course=e.target.value; setImportRows(rows); }} /></td>
                      <td className="py-2 pr-2 w-40"><input className="form-input" value={r.chapter} onChange={e => { const rows=[...importRows]; rows[idx].chapter=e.target.value; setImportRows(rows); }} /></td>
                      <td className="py-2 pr-2 w-40"><input className="form-input" value={r.tags || ''} onChange={e => { const rows=[...importRows]; rows[idx].tags=e.target.value; setImportRows(rows); }} /></td>
                      <td className="py-2 pr-2 w-48">{(r.errors||[]).length ? (<span className="text-red-600 text-xs">{r.errors.join('、')}</span>) : (<span className="text-green-600 text-xs">已就绪</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded">取消</button>
              <button
                onClick={async () => {
                  try {
                    const resp = await fetch(`${API_HOST}/api/questions/import/commit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authService.getToken() || ''}` },
                      body: JSON.stringify({ rows: importRows })
                    });
                    const data = await resp.json();
                    if (!resp.ok || !data?.success) {
                      alert(data?.error || '提交失败');
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
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >完成导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
