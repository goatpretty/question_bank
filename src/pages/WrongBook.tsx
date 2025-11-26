import { useState, useEffect } from 'react';
import { BookOpen, Target, Award, RotateCcw, Eye } from 'lucide-react';
import { authService } from '../services/authService';
const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;
import MathRenderer from '../components/MathRenderer';

interface WrongQuestion {
  id: string;
  userId: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  isMastered: boolean;
  masteredAt?: string;
  question?: Question;
}

interface Question {
  id: string;
  topicId: string;
  type: 'single' | 'multiple' | 'fill' | 'subjective';
  content: string;
  options?: { id: string; content: string }[];
  answer: string | string[];
  analysis: string;
  difficulty: number;
  score: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export default function WrongBook() {
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<WrongQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<WrongQuestion | null>(null);
  const [filter, setFilter] = useState<'all' | 'unmastered' | 'mastered'>('all');
  const [sortBy, setSortBy] = useState<'wrongCount' | 'lastWrongAt'>('lastWrongAt');
  const [stats, setStats] = useState({
    total: 0,
    mastered: 0,
    unmastered: 0,
    masteryRate: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWrongQuestions();
  }, []);

  useEffect(() => {
    filterAndSortQuestions();
  }, [wrongQuestions, filter, sortBy]);

  const fetchWrongQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_HOST}/api/users/wrongbook`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let data: any = { success: false, data: { wrongQuestions: [], total: 0 } };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        setWrongQuestions(data.data.wrongQuestions);
        setStats({
          total: data.data.total,
          mastered: data.data.wrongQuestions.filter((wq: WrongQuestion) => wq.isMastered).length,
          unmastered: data.data.wrongQuestions.filter((wq: WrongQuestion) => !wq.isMastered).length,
          masteryRate: data.data.total > 0 ? 
            (data.data.wrongQuestions.filter((wq: WrongQuestion) => wq.isMastered).length / data.data.total) * 100 : 0
        });
      }
    } catch (error) {
      console.error('获取错题本失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortQuestions = () => {
    let filtered = [...wrongQuestions];

    // Filter by mastery status
    if (filter === 'unmastered') {
      filtered = filtered.filter(wq => !wq.isMastered);
    } else if (filter === 'mastered') {
      filtered = filtered.filter(wq => wq.isMastered);
    }

    // Sort questions
    filtered.sort((a, b) => {
      if (sortBy === 'wrongCount') {
        return b.wrongCount - a.wrongCount;
      } else {
        return new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime();
      }
    });

    setFilteredQuestions(filtered);
  };

  const markAsMastered = async (questionId: string) => {
    try {
      const response = await fetch(`${API_HOST}/api/users/wrongbook/${questionId}/master`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        // Update local state
        setWrongQuestions(prev => 
          prev.map(wq => 
            wq.questionId === questionId 
              ? { ...wq, isMastered: true, masteredAt: new Date().toISOString() }
              : wq
          )
        );
      }
    } catch (error) {
      console.error('标记掌握失败:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels = {
      single: '单选题',
      multiple: '多选题',
      fill: '填空题',
      subjective: '主观题'
    };
    return labels[type as keyof typeof labels] || '未知题型';
  };

  // 取消难度标签展示

  if (selectedQuestion) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">错题详情</h2>
            <button
              onClick={() => setSelectedQuestion(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              返回列表
            </button>
          </div>

          <div className="space-y-6">
            {/* Question Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex space-x-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {getQuestionTypeLabel(selectedQuestion.question?.type || '')}
                  </span>
                  
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    错误次数: {selectedQuestion.wrongCount}
                  </span>
                </div>
                {selectedQuestion.isMastered ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    已掌握
                  </span>
                ) : (
                  <button
                    onClick={() => markAsMastered(selectedQuestion.questionId)}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded-full hover:bg-green-700"
                  >
                    标记掌握
                  </button>
                )}
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <MathRenderer content={selectedQuestion.question?.content || ''} />
              </h3>

              {/* Options for multiple choice questions */}
              {selectedQuestion.question?.options && (
                <div className="space-y-2 mb-4">
                  {selectedQuestion.question.options.map(option => (
                    <div key={option.id} className="flex items-center space-x-3 p-2 bg-white rounded border">
                      <span className="font-medium text-gray-700">{option.id}.</span>
                      <span className="text-gray-700"><MathRenderer content={option.content} /></span>
                      {selectedQuestion.question?.answer === option.id && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full ml-auto">
                          正确答案
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Answer and Analysis */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">正确答案:</h4>
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-800">
                      {Array.isArray(selectedQuestion.question?.answer) 
                        ? selectedQuestion.question.answer.join(', ')
                        : selectedQuestion.question?.answer}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">题目解析:</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-blue-800"><MathRenderer content={selectedQuestion.question?.analysis || ''} /></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Wrong Question Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center">
                  <RotateCcw className="h-8 w-8 text-red-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">错误次数</p>
                    <p className="text-2xl font-bold text-red-600">{selectedQuestion.wrongCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center">
                  <Target className="h-8 w-8 text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">最后错误</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(selectedQuestion.lastWrongAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-green-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">掌握状态</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedQuestion.isMastered ? '已掌握' : '未掌握'}
                    </p>
                    {selectedQuestion.masteredAt && (
                      <p className="text-xs text-gray-500">
                        {formatDate(selectedQuestion.masteredAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">错题本</h1>
        <p className="text-gray-600">查看和管理您的错题，针对性复习提高</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <BookOpen className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">总错题数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">未掌握</p>
              <p className="text-2xl font-bold text-red-600">{stats.unmastered}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">已掌握</p>
              <p className="text-2xl font-bold text-green-600">{stats.mastered}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-purple-600 font-bold">%</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">掌握率</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.masteryRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">筛选:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'unmastered' | 'mastered')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部错题</option>
              <option value="unmastered">未掌握</option>
              <option value="mastered">已掌握</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">排序:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'wrongCount' | 'lastWrongAt')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="lastWrongAt">最近错误时间</option>
              <option value="wrongCount">错误次数</option>
            </select>
          </div>
        </div>
      </div>

      {/* Wrong Questions List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">错题列表</h2>
          <p className="text-sm text-gray-600 mt-1">
            共 {filteredQuestions.length} 道错题
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无错题</h3>
              <p className="text-gray-600">您还没有错题记录，继续保持！</p>
            </div>
          ) : (
            filteredQuestions.map((wrongQuestion) => (
              <div key={wrongQuestion.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {getQuestionTypeLabel(wrongQuestion.question?.type || '')}
                      </span>
                      
                      {wrongQuestion.isMastered ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          已掌握
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          未掌握
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-2 line-clamp-2">
                      <MathRenderer content={wrongQuestion.question?.content || ''} />
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>错误次数: {wrongQuestion.wrongCount}</span>
                      <span>最后错误: {formatDate(wrongQuestion.lastWrongAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {!wrongQuestion.isMastered && (
                      <button
                        onClick={() => markAsMastered(wrongQuestion.questionId)}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded-full hover:bg-green-700"
                      >
                        掌握
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedQuestion(wrongQuestion)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="查看详情"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
