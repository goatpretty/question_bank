import { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Award, Target, PenTool } from 'lucide-react';
import { useExamStore } from '../stores/exam';
import { usePracticeStore } from '../stores/practice';
import { PracticeSession } from '../../shared/types';
import ExamResultModal from '../components/ExamResultModal';

interface ExamSubmission {
  id: string;
  examId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: 'in_progress' | 'completed';
  score: number;
  totalScore: number;
  maxScore: number;
  percentScore: number;
  correctCount: number;
  totalCount: number;
  totalQuestions: number;
  completedAt?: Date;
}

interface LearningStats {
  totalPracticeSessions: number;
  totalExamSubmissions: number;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  averageAccuracy: number;
  totalStudyTime: number;
  weeklyActivity: {
    date: string;
    practiceCount: number;
    examCount: number;
    accuracy: number;
  }[];
}

function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateStr(value: string | Date | undefined | null): string {
  const d = toDate(value);
  return d ? d.toISOString().split('T')[0] : '';
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeStats(
  practiceSessions: PracticeSession[],
  examSubmissions: ExamSubmission[]
): LearningStats {
  const safePractice = Array.isArray(practiceSessions) ? practiceSessions : [];
  const safeExam = Array.isArray(examSubmissions) ? examSubmissions : [];

  const practiceAccuracies = safePractice
    .filter(p => p.totalQuestions > 0)
    .map(p => p.correctCount / p.totalQuestions);

  const examAccuracies = safeExam
    .filter(e => e.totalScore > 0)
    .map(e => e.score / e.totalScore);

  const allAccuracies = [...practiceAccuracies, ...examAccuracies];

  const averageAccuracy = allAccuracies.length > 0
    ? clampPercent((allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length) * 100)
    : 0;

  const practiceAnsweredTotal = safePractice.reduce(
    (sum, p) => sum + (p.totalQuestions ?? 0),
    0,
  );

  const examAnsweredTotal = safeExam.reduce(
    (sum, e) => sum + (e.totalQuestions ?? e.totalCount ?? 0),
    0,
  );

  const totalQuestionsAnswered = practiceAnsweredTotal + examAnsweredTotal;

  const totalCorrectAnswers = safePractice.reduce(
    (sum, p) => sum + (p.correctCount ?? 0),
    0,
  ) + safeExam.reduce(
    (sum, e) => sum + (e.correctCount ?? 0),
    0,
  );

  const weeklyActivity = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayPractice = safePractice.filter(
      s => toDateStr(s.startTime) === dateStr || toDateStr((s as any).completedAt) === dateStr || toDateStr((s as any).endTime) === dateStr,
    );
    const dayExam = safeExam.filter(
      s => toDateStr(s.startTime) === dateStr || toDateStr((s as any).completedAt) === dateStr || toDateStr((s as any).endTime) === dateStr,
    );

    const dayPracticeAcc = dayPractice
      .filter(p => p.totalQuestions > 0)
      .map(p => p.correctCount / p.totalQuestions);

    const dayExamAcc = dayExam
      .filter(e => e.totalScore > 0)
      .map(e => e.score / e.totalScore);

    const dayAllAcc = [...dayPracticeAcc, ...dayExamAcc];
    const dayAccuracy = dayAllAcc.length > 0
      ? clampPercent((dayAllAcc.reduce((a, b) => a + b, 0) / dayAllAcc.length) * 100)
      : 0;

    weeklyActivity.push({
      date: dateStr,
      practiceCount: dayPractice.length,
      examCount: dayExam.length,
      accuracy: dayAccuracy,
    });
  }

  return {
    totalPracticeSessions: safePractice.length,
    totalExamSubmissions: safeExam.length,
    totalQuestionsAnswered,
    totalCorrectAnswers,
    averageAccuracy,
    totalStudyTime: safePractice.length * 15 + safeExam.length * 30,
    weeklyActivity,
  };
}

export default function Record() {
  const { examHistory, fetchExamHistory, error: examError, examResult, fetchExamResult } = useExamStore();
  const { sessionHistory, fetchSessionHistory, error: practiceError } = usePracticeStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'practice' | 'exam'>('overview');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  useEffect(() => {
    fetchLearningData();
  }, []);

  const fetchLearningData = async () => {
    setLoading(true);
    setPageError(null);
    try {
      await Promise.all([fetchExamHistory(), fetchSessionHistory()]);
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('401')) {
        setPageError('请重新登录后再试');
      } else if (msg.includes('500')) {
        setPageError('服务器错误，请稍后重试');
      } else {
        setPageError(`获取学习记录失败: ${msg}`);
      }
      console.error('获取学习记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const safeExamHistory = useMemo(
    () => {
      const raw = Array.isArray(examHistory) ? examHistory : [];
      return raw.filter((s: any) => s.status === 'completed' || s.completedAt || s.completed === true);
    },
    [examHistory],
  );
  const safeSessionHistory = useMemo(
    () => Array.isArray(sessionHistory) ? sessionHistory : [],
    [sessionHistory],
  );

  const stats = useMemo(
    () => computeStats(safeSessionHistory, safeExamHistory),
    [safeSessionHistory, safeExamHistory],
  );

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('zh-CN');
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes > 0 ? remainingMinutes + '分钟' : ''}`;
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-600 dark:text-green-400';
    if (accuracy >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-green-100 dark:bg-green-900';
    if (accuracy >= 60) return 'bg-amber-100 dark:bg-amber-900';
    return 'bg-red-100 dark:bg-red-900';
  };

  const handleViewDetails = async (sid: string) => {
    await fetchExamResult(sid);
    setResultModalOpen(true);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">正在加载学习记录...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8">
          <p className="text-red-700 dark:text-red-300 font-medium">{pageError}</p>
          <button
            onClick={fetchLearningData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {(examError || practiceError) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8">
          <p className="text-yellow-700 dark:text-yellow-300 font-medium">{examError || practiceError}</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">学习记录</h1>
        <p className="text-gray-600 dark:text-gray-400">查看您的学习进度和成绩统计</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-amber-500 dark:text-amber-400 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">练习次数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPracticeSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-500 dark:text-green-400 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">考试次数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalExamSubmissions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-amber-500 dark:text-amber-400 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">答题总数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalQuestionsAnswered}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-orange-500 dark:text-orange-400 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">平均正确率</p>
              <p className={`text-2xl font-bold ${getAccuracyColor(stats.averageAccuracy)}`}>
                {stats.averageAccuracy.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">最近7天学习活动</h2>
        <div className="space-y-4">
          {stats.weeklyActivity.map((day) => (
            <div key={day.date} className="flex items-center space-x-4">
              <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                {new Date(day.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((day.practiceCount + day.examCount) * 20, 100)}%` }}
                ></div>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">{day.practiceCount + day.examCount}次</span>
                {day.accuracy > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs ${getAccuracyBg(day.accuracy)} ${getAccuracyColor(day.accuracy)}`}>
                    {day.accuracy.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              总览
            </button>
            <button
              onClick={() => setActiveTab('practice')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'practice'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              练习记录
            </button>
            <button
              onClick={() => setActiveTab('exam')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'exam'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              考试记录
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'practice' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">练习记录</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {safeSessionHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">暂无练习记录</h3>
                <p className="text-gray-600 dark:text-gray-400">您还没有进行过任何练习</p>
              </div>
            ) : (
              safeSessionHistory.map(session => {
                const answeredCount = session.totalQuestions ?? 0;
                const correctCount = session.correctCount ?? 0;
                const accuracy = answeredCount > 0
                  ? ((correctCount / answeredCount) * 100).toFixed(1)
                  : '0.0';
                const accuracyColor = getAccuracyColor(Number(accuracy));
                return (
                <div key={session.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                        <PenTool className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          练习 - {answeredCount}题
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(session.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {correctCount}/{answeredCount}
                      </p>
                      <p className={`text-sm ${accuracyColor}`}>
                        {accuracy}%
                      </p>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'exam' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">考试记录</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {safeExamHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Target className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">暂无考试记录</h3>
                <p className="text-gray-600 dark:text-gray-400">您还没有参加过任何考试</p>
              </div>
            ) : (
              safeExamHistory.map(submission => {
                const exam = examHistory.find((e: any) => e.id === submission.examId);
                const examName = (exam as any)?.name || `考试 ${submission.id.slice(-6)}`;
                const obtained = Number(submission.score ?? 0);
                const maxScore = Number(submission.totalScore ?? submission.maxScore ?? 0);
                const accuracy = maxScore > 0
                  ? clampPercent(Math.round((obtained / maxScore) * 100))
                  : 0;
                const accuracyColor = getAccuracyColor(accuracy);
                const totalQ = submission.totalQuestions ?? submission.totalCount ?? '';
                return (
                  <div key={submission.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                          <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {examName}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(submission.startTime)}
                            {totalQ && (
                              <span className="ml-2 text-gray-400 dark:text-gray-500">题目: {totalQ}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          已完成
                        </p>
                        <p className={`text-sm font-medium ${accuracyColor}`}>
                          {accuracy}%
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          原始分数: {obtained} / {maxScore}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          用时: {formatTime(Math.floor(((toDate(submission.endTime)?.getTime() ?? 0) - (toDate(submission.startTime)?.getTime() ?? 0)) / 60000))}
                        </p>
                        {submission.status === 'completed' && (
                          <button
                            onClick={() => handleViewDetails(submission.id)}
                            className="mt-2 px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                          >
                            查看详情
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

      <ExamResultModal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        examName="考试详情"
        result={examResult}
      />
    </div>
  );
}
