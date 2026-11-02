import { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, BookOpen, Play, CheckCircle, AlertCircle } from 'lucide-react';
import MathRenderer from '../components/MathRenderer';
import ExamResultModal from '../components/ExamResultModal';
import PracticeAnswerCard from '../components/PracticeAnswerCard';
import { useExamStore } from '../stores/exam';

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
  const store = useExamStore();
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [resultOpen, setResultOpen] = useState(false);
  const [answerType, setAnswerType] = useState<'single' | 'multiple' | 'text'>('text');
  const [localAnswer, setLocalAnswer] = useState<string | string[]>('');
  const [savingAnswer, setSavingAnswer] = useState(false);
  const answerBusy = useRef(false);

  const {
    exams,
    currentExam,
    submissionId,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    userAnswers,
    examResult,
    examHistory,
    timeRemaining,
    isLoading,
    error,
    fetchExams,
    startExam,
    answerQuestion,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    submitExam,
    fetchExamResult,
    fetchExamHistory,
    endExam,
    tickTimer,
  } = store;

  const currentOrder = currentQuestionIndex + 1;

  useEffect(() => {
    fetchExams();
    fetchExamHistory();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (submissionId && timeRemaining > 0) {
      timer = setInterval(() => {
        if (timeRemaining <= 1) {
          handleSubmitExam(true);
          return;
        }
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [submissionId, timeRemaining, tickTimer]);

  useEffect(() => {
    if (!currentQuestion) return;
    if (currentQuestion.type === 'multiple') {
      setAnswerType('multiple');
      setLocalAnswer((userAnswers[currentOrder] as string[]) ?? []);
    } else if (currentQuestion.type === 'single') {
      setAnswerType('single');
      setLocalAnswer((userAnswers[currentOrder] as string) ?? '');
    } else {
      setAnswerType('text');
      setLocalAnswer((userAnswers[currentOrder] as string) ?? '');
    }
  }, [currentQuestion, currentOrder]);

  const computeQuestionCount = (exam: any) => {
    try {
      if (!Array.isArray(exam.rules)) return 0;
      const byType: Record<string, number> = {};
      const norm = (t: string) => {
        const s = String(t || '').toLowerCase().trim();
        if (['single', 'single_choice', 'scq', '单', '单选题'].includes(s)) return 'single';
        if (['multiple', 'multiple_choice', 'mcq', '多', '多选题'].includes(s)) return 'multiple';
        if (['fill', 'gap', 'blank', '填空', '填空题'].includes(s)) return 'fill';
        if (['subjective', 'essay', '主观', '主观题'].includes(s)) return 'subjective';
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

  const availableExams = exams.filter(
    (e: any) => (e as any).status === 'published' && ((e as any).isActive ?? true),
  );

  const safeExamHistory = useMemo(
    () => {
      const raw = Array.isArray(examHistory) ? examHistory : [];
      return raw.filter((s: any) => s.status === 'completed' || s.completedAt || s.completed === true);
    },
    [examHistory],
  );

  const handleStartExam = async (examId: string) => {
    await startExam(examId);
  };

  const handleAnswerChange = async (answer: string | string[]) => {
    if (answerBusy.current || isLoading || !currentQuestion) return;
    setLocalAnswer(answer);
    // Text answers can still be edited continuously; choice answers finish on selection.
    if (currentQuestion.type !== 'single' && currentQuestion.type !== 'multiple') {
      void answerQuestion(currentQuestion.id, answer);
      return;
    }
    answerBusy.current = true;
    setSavingAnswer(true);
    try {
      const saved = await answerQuestion(currentQuestion.id, answer);
      if (saved && currentQuestion.type === 'single' && currentOrder < totalQuestions) nextQuestion();
    } finally {
      answerBusy.current = false;
      setSavingAnswer(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentOrder >= totalQuestions) return;
    nextQuestion();
  };

  const handlePreviousQuestion = () => {
    if (answerBusy.current || isLoading) return;
    if (currentOrder <= 1) return;
    previousQuestion();
  };

  const handleGoToQuestion = (order: number) => {
    if (answerBusy.current || isLoading) return;
    goToQuestion(order - 1);
  };

  const handleSubmitAnswer = async () => {
    if (answerBusy.current || isLoading) return;
    if (answerType === 'single' && !localAnswer) {
      alert('请选择一个答案');
      return;
    }
    if (answerType === 'multiple' && (localAnswer as string[]).length === 0) {
      alert('请至少选择一个答案');
      return;
    }
    if (answerType === 'text' && !(localAnswer as string).trim()) {
      alert('请输入答案');
      return;
    }
    if (currentOrder < totalQuestions) {
      if (currentQuestion) {
        answerBusy.current = true;
        setSavingAnswer(true);
        const saved = await answerQuestion(currentQuestion.id, localAnswer);
        answerBusy.current = false;
        setSavingAnswer(false);
        if (!saved) return;
      }
      handleNextQuestion();
    } else {
      if (confirm('这是最后一题，是否要提交考试？')) {
        handleSubmitExam();
      }
    }
  };

  const handleSubmitExam = async (autoSubmit = false) => {
    const examName = (currentExam as any)?.name || (currentExam as any)?.title || '考试结果';
    (window as any).__examResultName = examName;
    await submitExam();
    alert(autoSubmit ? '考试时间到，已自动提交！' : '考试提交成功！');
    setResultOpen(true);
  };

  const handleExitExam = () => {
    if (confirm('确定要退出考试吗？当前进度将不会保存！')) {
      endExam();
    }
  };

  const handleViewResult = async (sid: string) => {
    await fetchExamResult(sid);
    setResultOpen(true);
  };

  const handleCloseResult = () => {
    setResultOpen(false);
    endExam();
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

  if (submissionId && currentExam && currentQuestion) {
    return (
      <div className="grid w-full min-w-0 mx-auto items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}，当前答案已保留，请重试。</div>}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4 sm:space-y-0">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{(currentExam as any).name || (currentExam as any).title}</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">{(currentExam as any).description || ''}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-lg sm:text-2xl font-bold ${timeRemaining < 300 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                <Clock className="inline w-4 sm:w-5 h-4 sm:h-5 mr-1 sm:mr-2" />
                {formatTime(timeRemaining)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                题目 {currentOrder} / {totalQuestions}
              </div>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="prose max-w-none dark:prose-invert">
                <MathRenderer content={currentQuestion.content} />
              </div>
            </div>

            {currentQuestion.type === 'single' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option: any, idx: number) => {
                  const label = option.displayLabel || String.fromCharCode(65 + idx);
                  return (
                    <label key={option.id} className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="answer"
                        value={option.id}
                        checked={localAnswer === option.id}
                        disabled={isLoading || savingAnswer}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        className="w-4 h-4 text-amber-600 border-gray-300 dark:border-gray-600 focus:ring-amber-500 bg-white dark:bg-gray-700"
                      />
                      <span className="text-gray-700 dark:text-gray-300 font-medium mr-1">{label}.</span>
                      <span className="text-gray-700 dark:text-gray-300"><MathRenderer content={option.content} /></span>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'multiple' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option: any, idx: number) => {
                  const label = option.displayLabel || String.fromCharCode(65 + idx);
                  return (
                    <label key={option.id} className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        value={option.id}
                        checked={Array.isArray(localAnswer) && localAnswer.includes(option.id)}
                        disabled={isLoading || savingAnswer}
                        onChange={(e) => {
                          const currentAnswers = Array.isArray(localAnswer) ? [...localAnswer] : [];
                          if (e.target.checked) {
                            handleAnswerChange([...currentAnswers, option.id]);
                          } else {
                            handleAnswerChange(currentAnswers.filter((id: string) => id !== option.id));
                          }
                        }}
                        className="w-4 h-4 text-amber-600 border-gray-300 dark:border-gray-600 rounded focus:ring-amber-500 bg-white dark:bg-gray-700"
                      />
                      <span className="text-gray-700 dark:text-gray-300 font-medium mr-1">{label}.</span>
                      <span className="text-gray-700 dark:text-gray-300"><MathRenderer content={option.content} /></span>
                    </label>
                  );
                })}
              </div>
            )}

            {(currentQuestion.type === 'fill' || currentQuestion.type === 'subjective') && (
              <div>
                <textarea
                  value={localAnswer as string}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  placeholder={currentQuestion.type === 'fill' ? '请输入答案' : '请输入主观题答案'}
                  rows={currentQuestion.type === 'subjective' ? 6 : 3}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="flex flex-wrap gap-2 sm:space-x-4">
              <button
                onClick={handleExitExam}
                className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                退出考试
              </button>
              {currentOrder > 1 && (
                <button
                  onClick={handlePreviousQuestion}
                  disabled={isLoading || savingAnswer}
                  className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  上一题
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:space-x-4">
              {currentOrder < totalQuestions && (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={isLoading || savingAnswer}
                  className="px-4 sm:px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {isLoading ? '保存中...' : '下一题'}
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('确定要提交考试吗？提交后将无法修改答案！')) {
                    handleSubmitExam();
                  }
                }}
                disabled={isLoading || savingAnswer}
                className="px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? '提交中...' : '提交考试'}
              </button>
            </div>
          </div>
        </div>
        <PracticeAnswerCard questions={Array.from({ length: totalQuestions }, (_, index) => ({ id: String(index + 1) }))}
          answers={userAnswers} currentIndex={currentQuestionIndex} disabled={isLoading || savingAnswer}
          onSelect={index => handleGoToQuestion(index + 1)} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">考试中心</h1>
        <p className="text-gray-600 dark:text-gray-400">参加在线考试，检验学习成果</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('available')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'available'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              可参加考试
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              考试历史
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {availableExams.length === 0 ? (
            <div className="col-span-full text-center py-8 sm:py-12">
              <BookOpen className="mx-auto h-10 sm:h-12 w-10 sm:w-12 text-gray-400 dark:text-gray-500 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">暂无可用考试</h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">请稍后再查看是否有新的考试</p>
            </div>
          ) : (
            availableExams.map(exam => (
              <div key={exam.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">{(exam as any).name || (exam as any).title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">{(exam as any).description || ''}</p>
                  </div>
                  <CheckCircle className="h-5 sm:h-6 w-5 sm:w-6 text-green-500 dark:text-green-400 flex-shrink-0" />
                </div>

                <div className="space-y-1 sm:space-y-2 mb-4 sm:mb-6">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">题目数量:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{(exam as any).questionCount ?? computeQuestionCount(exam)}题</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">考试时长:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{exam.duration}分钟</span>
                  </div>
                  {(exam as any).startTime && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600 dark:text-gray-400">开始时间:</span>
                      <span className="font-medium text-xs text-gray-900 dark:text-gray-100">{formatDateTime((exam as any).startTime)}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleStartExam(exam.id)}
                  disabled={isLoading}
                  className="w-full bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm sm:text-base"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {isLoading ? '准备中...' : '开始考试'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">考试历史</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {safeExamHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">暂无考试记录</h3>
                <p className="text-gray-600 dark:text-gray-400">您还没有参加过任何考试</p>
              </div>
            ) : (
              safeExamHistory.map((submission: ExamSubmission) => {
                if (submission.status !== 'completed' && !(submission as any).completedAt) return null;
                const exam = exams.find((e: any) => e.id === (submission as any).examId);
                const percentScore = Number((submission as any).percentScore ?? 0);
                const questionCount = (submission as any).questionCount || '';
                return (
                  <div key={submission.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {(exam as any)?.name || (exam as any)?.title || '未知考试'}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          考试时间: {formatDateTime(submission.startTime)}
                          {questionCount && (
                            <span className="ml-3 text-gray-400 dark:text-gray-500">
                              题目: {questionCount}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          得分: {percentScore}分
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          已完成
                        </div>
                        <button
                          onClick={() => handleViewResult(submission.id)}
                          className="mt-2 px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                        >
                          查看详情
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <ExamResultModal
        isOpen={resultOpen}
        onClose={handleCloseResult}
        examName={(currentExam as any)?.name || (currentExam as any)?.title || (window as any).__examResultName || '考试结果'}
        result={examResult}
      />
    </div>
  );
}
