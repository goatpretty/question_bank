import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, Award, Clock, Target, PenTool } from 'lucide-react';
import { authService } from '../services/authService';
const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;

interface PracticeSession {
  id: string;
  userId: string;
  topicIds: string[];
  totalQuestions: number;
  correctCount: number;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'completed';
}

interface ExamSubmission {
  id: string;
  examId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: 'in_progress' | 'completed';
  score: number;
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

export default function Record() {
  const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>([]);
  const [examHistory, setExamHistory] = useState<ExamSubmission[]>([]);
  const [stats, setStats] = useState<LearningStats>({
    totalPracticeSessions: 0,
    totalExamSubmissions: 0,
    totalQuestionsAnswered: 0,
    totalCorrectAnswers: 0,
    averageAccuracy: 0,
    totalStudyTime: 0,
    weeklyActivity: []
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'practice' | 'exam'>('overview');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLearningData();
  }, []);

  const fetchLearningData = async () => {
    setLoading(true);
    try {
      // Fetch practice history
      const practiceResponse = await fetch(`${API_HOST}/api/practice/history`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let practiceData: any = { success: false, data: { sessions: [] } };
      try {
        practiceData = await practiceResponse.json();
      } catch {
        practiceData = { success: false, data: { sessions: [] } };
      }
      
      // Fetch exam history
      const examResponse = await fetch(`${API_HOST}/api/exams/history`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let examData: any = { success: false, data: { submissions: [] } };
      try {
        examData = await examResponse.json();
      } catch {
        examData = { success: false, data: { submissions: [] } };
      }

      if (practiceData.success) {
        setPracticeHistory(practiceData.data.sessions);
      }

      if (examData.success) {
        setExamHistory(examData.data.submissions);
      }

      // Calculate stats
      calculateStats(practiceData.data?.sessions || [], examData.data?.submissions || []);
    } catch (error) {
      console.error('获取学习记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (practiceSessions: PracticeSession[], examSubmissions: ExamSubmission[]) => {
    const totalPracticeQuestions = practiceSessions.reduce((sum, session) => sum + session.totalQuestions, 0);
    const totalCorrectAnswers = practiceSessions.reduce((sum, session) => sum + session.correctCount, 0);
    const totalQuestionsAnswered = totalPracticeQuestions;
    const averageAccuracy = totalQuestionsAnswered > 0 ? (totalCorrectAnswers / totalQuestionsAnswered) * 100 : 0;
    
    // Calculate weekly activity (last 7 days)
    const weeklyActivity = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayPracticeSessions = practiceSessions.filter(session => 
        session.startTime.split('T')[0] === dateStr
      );
      
      const dayExamSubmissions = examSubmissions.filter(submission => 
        submission.startTime.split('T')[0] === dateStr
      );
      
      const dayTotalQuestions = dayPracticeSessions.reduce((sum, session) => sum + session.totalQuestions, 0);
      const dayCorrectAnswers = dayPracticeSessions.reduce((sum, session) => sum + session.correctCount, 0);
      const dayAccuracy = dayTotalQuestions > 0 ? (dayCorrectAnswers / dayTotalQuestions) * 100 : 0;
      
      weeklyActivity.push({
        date: dateStr,
        practiceCount: dayPracticeSessions.length,
        examCount: dayExamSubmissions.length,
        accuracy: dayAccuracy
      });
    }

    setStats({
      totalPracticeSessions: practiceSessions.length,
      totalExamSubmissions: examSubmissions.length,
      totalQuestionsAnswered,
      totalCorrectAnswers,
      averageAccuracy,
      totalStudyTime: practiceSessions.length * 15 + examSubmissions.length * 30, // Estimated minutes
      weeklyActivity
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
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
    if (accuracy >= 80) return 'text-green-600';
    if (accuracy >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-green-100';
    if (accuracy >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">学习记录</h1>
        <p className="text-gray-600">查看您的学习进度和成绩统计</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">练习次数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPracticeSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">考试次数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalExamSubmissions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">答题总数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalQuestionsAnswered}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-orange-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">平均正确率</p>
              <p className={`text-2xl font-bold ${getAccuracyColor(stats.averageAccuracy)}`}>
                {stats.averageAccuracy.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">最近7天学习活动</h2>
        <div className="space-y-4">
          {stats.weeklyActivity.map((day, index) => (
            <div key={day.date} className="flex items-center space-x-4">
              <div className="w-20 text-sm text-gray-600">
                {new Date(day.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((day.practiceCount + day.examCount) * 20, 100)}%` }}
                ></div>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-600">{day.practiceCount + day.examCount}次</span>
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

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              总览
            </button>
            <button
              onClick={() => setActiveTab('practice')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'practice'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              练习记录
            </button>
            <button
              onClick={() => setActiveTab('exam')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'exam'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              考试记录
            </button>
          </nav>
        </div>
      </div>

      {/* Practice Records */}
      {activeTab === 'practice' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">练习记录</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {practiceHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无练习记录</h3>
                <p className="text-gray-600">您还没有进行过任何练习</p>
              </div>
            ) : (
              practiceHistory.map(session => (
                <div key={session.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <PenTool className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          练习 - {session.totalQuestions}题
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(session.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {session.correctCount}/{session.totalQuestions}
                      </p>
                      <p className={`text-sm ${getAccuracyColor((session.correctCount / session.totalQuestions) * 100)}`}>
                        {((session.correctCount / session.totalQuestions) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Exam Records */}
      {activeTab === 'exam' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">考试记录</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {examHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无考试记录</h3>
                <p className="text-gray-600">您还没有参加过任何考试</p>
              </div>
            ) : (
              examHistory.map(submission => (
                <div key={submission.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Award className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          考试 - {submission.score}分
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(submission.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {submission.status === 'completed' ? '已完成' : '进行中'}
                      </p>
                      <p className="text-sm text-gray-600">
                        用时: {formatTime(Math.floor((new Date(submission.endTime).getTime() - new Date(submission.startTime).getTime()) / 60000))}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
