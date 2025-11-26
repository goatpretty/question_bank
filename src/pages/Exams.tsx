import { useState, useEffect } from 'react';
import { Clock, BookOpen, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { authService } from '../services/authService';
const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;
import MathRenderer from '../components/MathRenderer';

interface Exam {
  id: string;
  title: string;
  description: string;
  topicIds: string[];
  questionCount: number;
  duration: number;
  startTime: string;
  endTime: string;
  maxAttempts: number;
  createdBy: string;
  status: 'draft' | 'published' | 'completed';
  createdAt: Date;
  updatedAt: Date;
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

interface ExamSubmission {
  id: string;
  examId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: 'in_progress' | 'completed';
  score: number;
  completedAt?: Date;
}

export default function Exams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<string | string[]>('');
  const [answerType, setAnswerType] = useState<'single' | 'multiple' | 'text'>('text');
  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [currentQuestionOrder, setCurrentQuestionOrder] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTakingExam, setIsTakingExam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [examHistory, setExamHistory] = useState<ExamSubmission[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [examResult, setExamResult] = useState<{ results: Array<{ question: Question; order: number; userAnswer: any; isCorrect: boolean; score: number }>; totalScore: number; maxScore: number } | null>(null);

  useEffect(() => {
    fetchExams();
    fetchExamHistory();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTakingExam && submission && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up, auto-submit
            submitExam(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTakingExam, submission, timeRemaining]);

  const computeQuestionCount = (exam: any) => {
    try {
      if (!Array.isArray(exam.rules)) return 0;
      const byType: Record<string, number> = {};
      const norm = (t: string) => {
        const s = String(t || '').toLowerCase().trim();
        if (['single','single_choice','scq','单选','单选题'].includes(s)) return 'single';
        if (['multiple','multiple_choice','mcq','多选','多选题'].includes(s)) return 'multiple';
        if (['fill','gap','blank','填空','填空题'].includes(s)) return 'fill';
        if (['subjective','essay','主观','主观题'].includes(s)) return 'subjective';
        return s;
      };
      for (const r of exam.rules) {
        for (const qt of (r.questionTypes || [])) {
          const c = parseInt(qt.count) || 0;
          const key = norm(qt.type);
          byType[key] = Math.max(byType[key] || 0, c);
        }
      }
      return Object.values(byType).reduce((sum, n) => sum + n, 0);
    } catch { return 0; }
  };

  const fetchExams = async () => {
    try {
      const response = await fetch(`${API_HOST}/api/exams`);
      let data: any = { success: false, data: { exams: [] } };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        const enriched = (data.data.exams || []).map((e: any) => ({
          ...e,
          questionCount: e.questionCount ?? computeQuestionCount(e)
        }));
        setExams(enriched);
        const available = enriched.filter((e: any) => e.status === 'published' && (e.isActive ?? true));
        setAvailableExams(available);
      }
    } catch (error) {
      console.error('获取考试列表失败:', error);
    }
  };

  const fetchExamHistory = async () => {
    try {
      const response = await fetch(`${API_HOST}/api/exams/history`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let data: any = { success: false, data: { submissions: [] } };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        setExamHistory(data.data.submissions);
      }
    } catch (error) {
      console.error('获取考试历史失败:', error);
    }
  };

  const startExam = async (examId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_HOST}/api/exams/${examId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        const newSubmission = data.data;
        setSubmission(newSubmission);
        setCurrentExam(exams.find(e => e.id === examId) || null);
        setIsTakingExam(true);
        setTimeRemaining(Math.floor((new Date(newSubmission.endTime).getTime() - new Date().getTime()) / 1000));
        fetchExamQuestion(newSubmission.id, 1);
      } else {
        alert(data.error || '无法开始考试');
      }
    } catch (error) {
      console.error('开始考试失败:', error);
      alert('开始考试失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchExamQuestion = async (submissionId: string, order: number) => {
    try {
      const response = await fetch(`${API_HOST}/api/exams/submission/${submissionId}/question/${order}`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        setCurrentQuestion(data.data.question);
        setCurrentQuestionOrder(data.data.order);
        setTotalQuestions(data.data.totalQuestions);
        
        // Reset answer based on question type
        if (data.data.question.type === 'multiple') {
          setCurrentAnswer(data.data.userAnswer || []);
          setAnswerType('multiple');
        } else if (data.data.question.type === 'single') {
          setCurrentAnswer(data.data.userAnswer || '');
          setAnswerType('single');
        } else {
          setCurrentAnswer(data.data.userAnswer || '');
          setAnswerType('text');
        }
      }
    } catch (error) {
      console.error('获取考试题目失败:', error);
    }
  };

  const submitAnswer = async (goToNext = true) => {
    if (!currentQuestion || !submission) return;

    // Validate answer based on question type
    if (answerType === 'single' && !currentAnswer) {
      alert('请选择一个答案');
      return;
    }
    if (answerType === 'multiple' && (currentAnswer as string[]).length === 0) {
      alert('请至少选择一个答案');
      return;
    }
    if (answerType === 'text' && !(currentAnswer as string).trim()) {
      alert('请输入答案');
      return;
    }

    try {
      const response = await fetch(`${API_HOST}/api/exams/submission/${submission.id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: currentAnswer
        })
      });
      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success && goToNext) {
        if (currentQuestionOrder < totalQuestions) {
          fetchExamQuestion(submission.id, currentQuestionOrder + 1);
        } else {
          // Last question, show completion dialog
          if (confirm('这是最后一题，是否要提交考试？')) {
            submitExam();
          }
        }
      }
    } catch (error) {
      console.error('提交答案失败:', error);
    }
  };

  const submitExam = async (autoSubmit = false) => {
    if (!submission || !currentQuestion) return;

    // Submit final answer if there's a current question
    if (currentAnswer) {
      await submitAnswer(false);
    }

    try {
      const response = await fetch(`${API_HOST}/api/exams/submission/${submission.id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: currentAnswer,
          completed: true
        })
      });
      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        setIsTakingExam(false);
        fetchExamHistory();
        alert(autoSubmit ? '考试时间到，已自动提交！' : '考试提交成功！');
        // 自动打开结果查看
        try {
          const resp = await fetch(`${API_HOST}/api/exams/submission/${submission.id}/result`, {
            headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
          });
          const rdata = await resp.json();
          if (resp.ok && rdata?.success) {
            setExamResult(rdata.data);
            setResultOpen(true);
          }
        } catch {}
      }
    } catch (error) {
      console.error('提交考试失败:', error);
      alert('提交考试失败');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (isTakingExam && currentExam && currentQuestion && submission) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          {/* Exam Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 pb-4 border-b space-y-4 sm:space-y-0">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{currentExam.title}</h2>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">{currentExam.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-lg sm:text-2xl font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-900'}`}>
                <Clock className="inline w-4 sm:w-5 h-4 sm:h-5 mr-1 sm:mr-2" />
                {formatTime(timeRemaining)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                题目 {currentQuestionOrder} / {totalQuestions}
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="mb-6 sm:mb-8">
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="prose max-w-none">
                <MathRenderer content={currentQuestion.content} />
              </div>
            </div>

            {currentQuestion.type === 'single' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map(option => (
                  <label key={option.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="answer"
                      value={option.id}
                      checked={currentAnswer === option.id}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{option.id}. <MathRenderer content={option.content} /></span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === 'multiple' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map(option => (
                  <label key={option.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      value={option.id}
                      checked={(currentAnswer as string[]).includes(option.id)}
                      onChange={(e) => {
                        const currentAnswers = currentAnswer as string[];
                        if (e.target.checked) {
                          setCurrentAnswer([...currentAnswers, option.id]);
                        } else {
                          setCurrentAnswer(currentAnswers.filter(id => id !== option.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{option.id}. <MathRenderer content={option.content} /></span>
                  </label>
                ))}
              </div>
            )}

            {(currentQuestion.type === 'fill' || currentQuestion.type === 'subjective') && (
              <div>
                <textarea
                  value={currentAnswer as string}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder={currentQuestion.type === 'fill' ? '请输入答案' : '请输入主观题答案'}
                  rows={currentQuestion.type === 'subjective' ? 6 : 3}
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="flex flex-wrap gap-2 sm:space-x-4">
              <button
                onClick={() => {
                  if (confirm('确定要退出考试吗？当前进度将不会保存。')) {
                    setIsTakingExam(false);
                  }
                }}
                className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                退出考试
              </button>
              {currentQuestionOrder > 1 && (
                <button
                  onClick={() => fetchExamQuestion(submission.id, currentQuestionOrder - 1)}
                  className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  上一题
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:space-x-4">
              {currentQuestionOrder < totalQuestions && (
                <button
                  onClick={() => submitAnswer(true)}
                  disabled={loading}
                  className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '保存中...' : '下一题'}
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('确定要提交考试吗？提交后将无法修改答案。')) {
                    submitExam();
                  }
                }}
                disabled={loading}
                className="px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? '提交中...' : '提交考试'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">考试中心</h1>
        <p className="text-gray-600">参加在线考试，检验学习成果</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('available')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'available'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              可参加考试
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              考试历史
            </button>
          </nav>
        </div>
      </div>

      {/* Available Exams */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {availableExams.length === 0 ? (
            <div className="col-span-full text-center py-8 sm:py-12">
              <BookOpen className="mx-auto h-10 sm:h-12 w-10 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">暂无可用考试</h3>
              <p className="text-sm sm:text-base text-gray-600">请稍后再查看是否有新的考试</p>
            </div>
          ) : (
            availableExams.map(exam => (
              <div key={exam.id} className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">{(exam as any).name || exam.title}</h3>
                    <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">{(exam as any).description || ''}</p>
                  </div>
                  <CheckCircle className="h-5 sm:h-6 w-5 sm:w-6 text-green-500 flex-shrink-0" />
                </div>
                
                <div className="space-y-1 sm:space-y-2 mb-4 sm:mb-6">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">题目数量:</span>
                    <span className="font-medium">{exam.questionCount}题</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">考试时长:</span>
                    <span className="font-medium">{exam.duration}分钟</span>
                  </div>
                  {(exam as any).startTime && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">开始时间:</span>
                      <span className="font-medium text-xs">{formatDateTime((exam as any).startTime)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">结束时间:</span>
                    <span className="font-medium text-xs">{formatDateTime(exam.endTime)}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => startExam(exam.id)}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm sm:text-base"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {loading ? '准备中...' : '开始考试'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Exam History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">考试历史</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {examHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无考试记录</h3>
                <p className="text-gray-600">您还没有参加过任何考试</p>
              </div>
            ) : (
              examHistory.map(submission => {
                const exam = exams.find(e => e.id === submission.examId);
                return (
                  <div key={submission.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{exam?.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          考试时间: {formatDateTime(submission.startTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          得分: {submission.score}分
                        </div>
                        <div className={`text-xs ${
                          submission.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {submission.status === 'completed' ? '已完成' : '进行中'}
                        </div>
                        {submission.status === 'completed' && (
                          <button
                            onClick={async () => {
                              try {
                                const resp = await fetch(`${API_HOST}/api/exams/submission/${submission.id}/result`, {
                                  headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
                                });
                                const data = await resp.json();
                                if (resp.ok && data?.success) {
                                  setExamResult(data.data);
                                  setResultOpen(true);
                                } else {
                                  alert(data?.error || '获取结果失败');
                                }
                              } catch (err) {
                                console.error('获取结果失败:', err);
                                alert('获取结果失败');
                              }
                            }}
                            className="mt-2 px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            查看错题
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 结果查看弹窗 */}
      {resultOpen && examResult && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-lg shadow-strong w-full max-w-5xl mx-4 my-8 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">考试结果</h3>
              <button onClick={() => setResultOpen(false)} className="text-gray-500 hover:text-gray-700">关闭</button>
            </div>
            <div className="mb-4 text-sm text-gray-700">总分：{examResult.totalScore} / {examResult.maxScore}</div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {examResult.results.map((r, idx) => (
                <div key={idx} className={`border rounded-lg p-4 ${r.isCorrect ? 'border-green-200' : 'border-red-200'}`}>
                  <div className="flex justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.isCorrect ? '正确' : '错误'}</span>
                    <span className="text-xs text-gray-500">第 {r.order} 题 · 分值 {r.score}</span>
                  </div>
                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <MathRenderer content={r.question.content} />
                  </div>
                  {r.question.options && (
                    <div className="text-sm text-gray-700 mb-2">参考答案：{Array.isArray(r.question.answer) ? (r.question.answer as string[]).join('、') : (r.question.answer as string)}</div>
                  )}
                  <div className="text-sm text-gray-700">你的答案：{Array.isArray(r.userAnswer) ? (r.userAnswer as string[]).join('、') : String(r.userAnswer || '')}</div>
                  {r.question.analysis && (
                    <div className="mt-2 text-sm text-gray-600">解析：<MathRenderer content={r.question.analysis} /></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
