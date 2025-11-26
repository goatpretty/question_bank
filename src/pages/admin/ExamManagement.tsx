import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Eye, Save, X, BarChart3 } from 'lucide-react';
import { examService } from '../../services/examService';
import { Exam, QuestionType, Topic } from '../../../shared/types';
import { authService } from '../../services/authService';
const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;

export default function ExamManagement() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
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
        score: 2
      }]
    }],
    isActive: true
  });
  const [topics, setTopics] = useState<Topic[]>([]);
  const subjects = topics.filter(t => !t.parentId);
  const chapters = (subjectId: string) => topics.filter(t => t.parentId === subjectId);
  const [chapterCountById, setChapterCountById] = useState<Record<string, number>>({});

  const questionTypes = [
    { value: 'single', label: '单选题' },
    { value: 'multiple', label: '多选题' },
    { value: 'fill', label: '填空题' },
    { value: 'subjective', label: '主观题' }
  ];

  const fetchTopics = async () => {
    try {
      const resp = await fetch(`${API_HOST}/api/questions/topics`, {
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      let data: any = { success: false, data: [] };
      try { data = await resp.json(); } catch {}
      if (data.success) setTopics(data.data);
    } catch (e) {
      console.error('获取章节失败:', e);
    }
  };

  const fetchChapterCount = async (chapterId: string) => {
    try {
      const resp = await fetch(`${API_HOST}/api/questions?topicId=${chapterId}&page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      let data: any = { success: false, data: { total: 0 } };
      try { data = await resp.json(); } catch {}
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
    fetchTopics();
  }, []);

  const fetchExams = async () => {
    try {
      const data = await examService.getAllExams();
      setExams(data.data.exams);
    } catch (error) {
      console.error('获取考试列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchTerm) return exams;
    
    return exams.filter(exam => 
      (exam.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.description || '').toLowerCase().includes(searchTerm.toLowerCase())
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
          score: 2
        }]
      }],
      isActive: true
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
            subjectId: (topics.find(t => t.id === rule.topicId)?.parentId) || '',
            chapterIds: [rule.topicId].filter(Boolean),
            questionTypes: Array.isArray(rule.questionTypes)
              ? rule.questionTypes.map((qt: any) => ({
                  type: qt.type as QuestionType,
                  count: qt.count ?? 0,
                  score: qt.score ?? 0,
                }))
              : [],
          }))
        : [{ subjectId: '', chapterIds: [], questionTypes: [{ type: 'single' as QuestionType, count: 5, score: 2 }] }],
      isActive: exam.isActive
    });
    setShowModal(true);
  };

  const handleView = (exam: Exam) => {
    setSelectedExam(exam);
    setShowDetailModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个考试吗？')) {
      try {
        await examService.deleteExam(id);
        fetchExams();
      } catch (error) {
        console.error('删除考试失败:', error);
      }
    }
  };
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ byType: Array<{ type: string; required: number; available: number }>; totalRequired: number; totalAvailable: number; warnings: string[] } | null>(null);

  const handlePreview = async (id: string) => {
    try {
      const resp = await fetch(`${API_HOST}/api/exams/${id}/preview`, {
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        alert(data?.error || '预览失败');
        return;
      }
      setPreviewData(data.data);
      setPreviewOpen(true);
    } catch (e) {
      console.error('预览试卷失败:', e);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const resp = await fetch(`${API_HOST}/api/exams/${id}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) alert(data?.error || '发布失败');
      fetchExams();
    } catch (e) { console.error('发布考试失败:', e); }
  };

  const handleUnpublish = async (id: string) => {
    try {
      const resp = await fetch(`${API_HOST}/api/exams/${id}/unpublish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) alert(data?.error || '取消发布失败');
      fetchExams();
    } catch (e) { console.error('取消发布考试失败:', e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const r of formData.rules) {
      if (!r.subjectId) {
        alert('请为每条规则选择科目');
        return;
      }
    }
    const backendRules = formData.rules.map((r) => ({ subjectId: r.subjectId, questionTypes: r.questionTypes }));
    try {
      const payload = {
        name: formData.name,
        description: formData.description ?? '',
        duration: formData.duration,
        rules: backendRules,
        isActive: formData.isActive,
        status: 'draft'
      };
      if (editingExam) {
        try {
          await examService.updateExam(editingExam.id, payload as any);
        } catch (err) {
          // 若更新失败（例如后端不存在该考试），降级为创建
          await examService.createExam(payload as any);
        }
      } else {
        await examService.createExam(payload as any);
      }
      setShowModal(false);
      fetchExams();
    } catch (error) {
      console.error('保存考试失败:', error);
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
          score: 2
        }]
      }]
    }));
  };

  const removeRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index)
    }));
  };

  const updateRule = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) => {
        if (i !== index) return rule;
        const next = { ...rule, [field]: value } as any;
        return next;
      })
    }));
  };

  const addQuestionType = (ruleIndex: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) => 
        i === ruleIndex ? {
          ...rule,
          questionTypes: [...rule.questionTypes, {
            type: 'single' as QuestionType,
            count: 5,
            score: 2
          }]
        } : rule
      )
    }));
  };

  const removeQuestionType = (ruleIndex: number, typeIndex: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) => 
        i === ruleIndex ? {
          ...rule,
          questionTypes: rule.questionTypes.filter((_, ti) => ti !== typeIndex)
        } : rule
      )
    }));
  };

  const updateQuestionType = (ruleIndex: number, typeIndex: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) => 
        i === ruleIndex ? {
          ...rule,
          questionTypes: rule.questionTypes.map((qt, ti) => 
            ti === typeIndex ? { ...qt, [field]: value } : qt
          )
        } : rule
      )
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

  const getTotalQuestions = (exam: Exam) => {
    const rules = Array.isArray(exam.rules) ? exam.rules : [];
    return rules.reduce((total, rule) => 
      total + (Array.isArray(rule.questionTypes) ? rule.questionTypes.reduce((sum, qt) => sum + (qt.count || 0), 0) : 0), 0
    );
  };

  const getTotalScore = (exam: Exam) => {
    const rules = Array.isArray(exam.rules) ? exam.rules : [];
    return rules.reduce((total, rule) => 
      total + (Array.isArray(rule.questionTypes) ? rule.questionTypes.reduce((sum, qt) => sum + ((qt.count || 0) * (qt.score || 0)), 0) : 0), 0
    );
  };

  const filteredExams = handleSearch();

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
        <h1 className="text-2xl font-bold text-gray-900">考试管理</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          新建考试
        </button>
      </div>

      {/* 搜索 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索考试名称或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 考试列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  考试名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  描述
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  时长
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  题目数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  总分
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExams.map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {exam.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">{exam.name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate" title={exam.description}>
                      {exam.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {exam.duration}分钟
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getTotalQuestions(exam)}题
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getTotalScore(exam)}分
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      exam.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {exam.isActive ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleView(exam)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="查看详情"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(exam)}
                        className="text-green-600 hover:text-green-900 transition-colors"
                        title="编辑"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePreview(exam.id)}
                        className="text-indigo-600 hover:text-indigo-900 transition-colors"
                        title="预览试卷"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </button>
                      {exam.status === 'published' ? (
                        <button
                          onClick={() => handleUnpublish(exam.id)}
                          className="text-yellow-600 hover:text-yellow-900 transition-colors"
                          title="取消发布"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublish(exam.id)}
                          className="text-green-700 hover:text-green-900 transition-colors"
                          title="发布"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(exam.id)}
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
        
        {filteredExams.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            暂无考试数据
          </div>
        )}
      </div>

      {/* 编辑/创建模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl bg-white rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingExam ? '编辑考试' : '新建考试'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    考试名称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    考试时长（分钟）
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="300"
                    required
                  />
                </div>
              </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    考试描述
                  </label>
                  <textarea
                    value={formData.description ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  启用考试
                </label>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    考试规则
                  </label>
                  <button
                    type="button"
                    onClick={addRule}
                    className="text-blue-600 hover:text-blue-900 text-sm"
                  >
                    + 添加规则
                  </button>
                </div>
                
                {formData.rules.map((rule, ruleIndex) => (
                  <div key={ruleIndex} className="border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900">规则 {ruleIndex + 1}</h4>
                      {formData.rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRule(ruleIndex)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
                      <select
                        value={rule.subjectId || ''}
                        onChange={(e) => updateRule(ruleIndex, 'subjectId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">选择科目</option>
                        {subjects.map(sub => (
                          <option key={sub.id} value={sub.id}>{sub.name}</option>
                        ))}
                      </select>
                    </div>
                    {/* 移除章节选择，改为按科目联合抽题 */}

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium text-gray-700">
                          题型设置
                        </label>
                        <button
                          type="button"
                          onClick={() => addQuestionType(ruleIndex)}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                        >
                          + 添加题型
                        </button>
                      </div>
                      
                      {rule.questionTypes.map((qt, typeIndex) => (
                        <div key={typeIndex} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <select
                            value={qt.type ?? 'single'}
                            onChange={(e) => updateQuestionType(ruleIndex, typeIndex, 'type', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            {questionTypes.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                          
                          <input
                            type="number"
                            value={qt.count ?? 0}
                            onChange={(e) => updateQuestionType(ruleIndex, typeIndex, 'count', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="数量"
                            min="1"
                          />
                          
                          <input
                            type="number"
                            value={qt.score ?? 0}
                            onChange={(e) => updateQuestionType(ruleIndex, typeIndex, 'score', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="分值"
                            min="1"
                          />
                          
                          <span className="text-sm text-gray-500">分/题</span>
                          
                          {rule.questionTypes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestionType(ruleIndex, typeIndex)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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

      {/* 预览模态框 */}
      {previewOpen && previewData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl bg-white rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">预览试卷题量与类型分布</h3>
              <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">题型</th>
                    <th className="py-2 pr-4">需求数量</th>
                    <th className="py-2 pr-4">可用数量</th>
                    <th className="py-2 pr-4">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.byType.map((r, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2 pr-4">{r.type === 'single' ? '单选题' : r.type === 'multiple' ? '多选题' : r.type === 'fill' ? '填空题' : '主观题'}</td>
                      <td className="py-2 pr-4">{r.required}</td>
                      <td className="py-2 pr-4">{r.available}</td>
                      <td className="py-2 pr-4">{r.available >= r.required ? <span className="text-green-600">可用</span> : <span className="text-red-600">不足</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-700">总题量：{previewData.totalRequired}（可用 {previewData.totalAvailable}）</div>
            {previewData.warnings.length > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm font-medium text-yellow-700">提示</div>
                <ul className="list-disc list-inside text-sm text-yellow-700">
                  {previewData.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 详情模态框 */}
      {showDetailModal && selectedExam && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl bg-white rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                考试详情 - {selectedExam.name}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">考试名称</label>
                  <p className="text-sm text-gray-900">{selectedExam.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">考试时长</label>
                  <p className="text-sm text-gray-900">{selectedExam.duration}分钟</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">描述</label>
                <p className="text-sm text-gray-900">{selectedExam.description}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">状态</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedExam.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedExam.isActive ? '启用' : '禁用'}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">考试规则</label>
                <div className="space-y-2">
                  {(Array.isArray(selectedExam.rules) ? selectedExam.rules : []).map((rule, index) => (
                    <div key={index} className="border border-gray-200 rounded p-3">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        知识点: {rule.topicId}
                      </p>
                      <div className="space-y-1">
                        {(Array.isArray(rule.questionTypes) ? rule.questionTypes : []).map((qt, qtIndex) => (
                          <p key={qtIndex} className="text-sm text-gray-600">
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
                  <label className="block text-sm font-medium text-gray-700">总题数</label>
                  <p className="text-sm text-gray-900">{getTotalQuestions(selectedExam)}题</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">总分</label>
                  <p className="text-sm text-gray-900">{getTotalScore(selectedExam)}分</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
