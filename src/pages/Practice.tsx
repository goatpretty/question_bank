import { useState, useEffect } from 'react';
import { BookOpen, Play, Check, X } from 'lucide-react';
import { authService } from '../services/authService';
const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;
import MathRenderer from '../components/MathRenderer';

interface Topic {
  id: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  createdAt: Date;
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

export default function Practice() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const subjects = topics.filter(t => !t.parentId);
  const chapters = (subjectId: string | null | string) => topics.filter(t => t.parentId === (subjectId || null));
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [questionCount, setQuestionCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [questionHistory, setQuestionHistory] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string | string[]>>({});
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResults, setReviewResults] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<{ total: number; correct: number; totalQuestions: number }>({ total: 0, correct: 0, totalQuestions: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      if (!selectedChapterId) {
        setQuestionCount(0);
        return;
      }
      try {
        const resp = await fetch(`${API_HOST}/api/questions?topicId=${selectedChapterId}&page=1&limit=1`, {
          headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
        });
        let data: any = { success: false, data: { total: 0 } };
        try { data = await resp.json(); } catch {}
        const total = data?.data?.total ?? 0;
        setQuestionCount(total);
      } catch {
        setQuestionCount(0);
      }
    };
    fetchCount();
  }, [selectedChapterId]);
  // 取消难度设置
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<string | string[]>('');
  const [answerType, setAnswerType] = useState<'single' | 'multiple' | 'text'>('text');
  const [practiceSession, setPracticeSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [gradingMode, setGradingMode] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [exitOpen, setExitOpen] = useState(false);

  const getTypeLabel = (type: Question['type']) => {
    switch (type) {
      case 'single': return '单选题';
      case 'multiple': return '多选题';
      case 'fill': return '填空题';
      case 'subjective': return '主观题';
      default: return '题目';
    }
  };

  useEffect(() => {
    fetchTopics();
    try {
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      setListMode(isMobile);
    } catch {}
  }, []);

  const fetchTopics = async () => {
    try {
      const response = await fetch(`${API_HOST}/api/questions/topics`, {
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      let data: any = { success: false, data: [] };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        setTopics(data.data);
      }
    } catch (error) {
      console.error('获取章节失败:', error);
    }
  };

  const startPractice = async () => {
    if (!selectedSubjectId || !selectedChapterId) {
      alert('请先选择科目与章节');
      return;
    }

    setLoading(true);
    try {
      // 获取该章节题目总数
      let total = 0;
      try {
        const chapter = (selectedChapterId || '').trim();
        const countResp = await fetch(`${API_HOST}/api/questions?topicId=${chapter}&page=1&limit=1`, {
          headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
        });
        let countData: any = { success: false, data: { total: 0 } };
        try { countData = await countResp.json(); } catch {}
        total = countData?.data?.total ?? 0;
      } catch {}
      setQuestionCount(total);
      if (total === 0) {
        alert('该章节暂无题目');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_HOST}/api/practice/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`
        },
        body: JSON.stringify({
          topicIds: [(selectedChapterId || '').trim()],
          questionCount: total,
          
        })
      });

      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        setPracticeSession(data.data);
        setAnsweredCount(0);
        if (listMode) {
          try {
            const resp = await fetch(`${API_HOST}/api/questions?topicId=${(selectedChapterId || '').trim()}&page=1&limit=10000`, {
              headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
            });
            let qdata: any = { success: false, data: { questions: [], total: 0 } };
            try { qdata = await resp.json(); } catch {}
            const qs: Question[] = qdata?.data?.questions || [];
            const randomizedQs = qs.map(q => ({
              ...q,
              options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : undefined
            }));
            const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
            const singles = randomizedQs.filter(q => q.type === 'single');
            const multiples = randomizedQs.filter(q => q.type === 'multiple');
            const fills = randomizedQs.filter(q => q.type === 'fill');
            const subjectives = randomizedQs.filter(q => q.type === 'subjective');
            const ordered = [
              ...shuffle(singles),
              ...shuffle(multiples),
              ...shuffle(fills),
              ...shuffle(subjectives)
            ];
            setAllQuestions(ordered);
            setQuestionCount(qdata?.data?.total || qs.length || total);
            setIsPracticing(true);
          } catch (e) {
            console.error('获取题目列表失败:', e);
          }
        } else {
          fetchNextQuestion(data.data.id, true, true);
        }
      }
    } catch (error) {
      console.error('开始练习失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextQuestion = async (sessionId: string, firstLoad: boolean = false, pushToHistory: boolean = false) => {
    try {
      const response = await fetch(`${API_HOST}/api/practice/question/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken() || ''}`
        }
      });
      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        const q = data.data;
        setCurrentQuestion(q);
        if (firstLoad) {
          setIsPracticing(true);
          setQuestionHistory([q]);
          setCurrentIndex(0);
        } else if (pushToHistory) {
          setQuestionHistory(prev => {
            const next = [...prev, q];
            setCurrentIndex(next.length - 1);
            return next;
          });
        }
        // Reset answer based on question type
        const saved = answersByQuestionId[q.id];
        if (q.type === 'multiple') {
          setCurrentAnswer(Array.isArray(saved) ? saved : []);
          setAnswerType('multiple');
        } else if (q.type === 'single') {
          setCurrentAnswer(typeof saved === 'string' ? saved : '');
          setAnswerType('single');
        } else {
          setCurrentAnswer(typeof saved === 'string' ? saved : '');
          setAnswerType('text');
        }
      } else {
        // No more questions or error
        const msg = String(data.error || '').toLowerCase();
        if (msg.includes('no questions available')) {
          if (firstLoad) {
            alert('该章节暂无题目，无法开始练习');
            setIsPracticing(false);
            return;
          }
        }
        if (msg.includes('no more questions available')) {
          setIsPracticing(false);
          alert('练习完成！');
        } else {
          console.error('获取题目失败:', data.error);
        }
      }
    } catch (error) {
      console.error('获取下一题失败:', error);
    }
  };

  const fetchPracticeResult = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_HOST}/api/practice/result/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      let data: any = { success: false };
      try { data = await response.json(); } catch {}
      if (data.success) {
        setReviewResults(data.data.results || []);
        setReviewStats({ total: data.data.total || 0, correct: data.data.correct || 0, totalQuestions: data.data.totalQuestions || 0 });
        setIsReviewing(true);
      }
    } catch (e) {
      console.error('获取练习结果失败:', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const resp = await fetch(`${API_HOST}/api/practice/history?page=1&limit=20`, {
        headers: { 'Authorization': `Bearer ${authService.getToken() || ''}` }
      });
      let data: any = { success: false };
      try { data = await resp.json(); } catch {}
      if (data.success) {
        setHistory(data.data.sessions || []);
      }
    } catch (e) {
      console.error('获取练习记录失败:', e);
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion || !practiceSession) return;

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

    setLoading(true);
    try {
      const response = await fetch(`${API_HOST}/api/practice/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`
        },
        body: JSON.stringify({
          practiceId: practiceSession.id,
          answers: [{
            questionId: currentQuestion.id,
            userAnswer: currentAnswer
          }],
          completed: false
        })
      });

      let data: any = { success: false };
      try { data = await response.json(); } catch { /* ignore */ }
      if (data.success) {
        setAnswersByQuestionId(prev => ({ ...prev, [currentQuestion.id]: currentAnswer }));
        // 获取下一题或结束练习
        setAnsweredCount(data.data.totalCount ?? answeredCount);
        if ((data.data.totalCount ?? 0) >= questionCount) {
          setIsPracticing(false);
          if (practiceSession?.id) {
            await fetchPracticeResult(practiceSession.id);
          }
        } else {
          // 等待用户点击“下一题”
        }
      }
    } catch (error) {
      console.error('提交答案失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const goPrevQuestion = () => {
    if (currentIndex > 0) {
      const idx = currentIndex - 1;
      setCurrentIndex(idx);
      const q = questionHistory[idx];
      if (!q) return;
      setCurrentQuestion(q);
      const saved = answersByQuestionId[q.id];
      if (q.type === 'multiple') {
        setCurrentAnswer(Array.isArray(saved) ? saved : []);
        setAnswerType('multiple');
      } else if (q.type === 'single') {
        setCurrentAnswer(typeof saved === 'string' ? saved : '');
        setAnswerType('single');
      } else {
        setCurrentAnswer(typeof saved === 'string' ? saved : '');
        setAnswerType('text');
      }
    }
  };

  const goNextQuestion = () => {
    if (!practiceSession) return;
    // 如果有下一题已经在历史中，直接前进索引
    if (currentIndex < questionHistory.length - 1) {
      const idx = currentIndex + 1;
      setCurrentIndex(idx);
      const q = questionHistory[idx];
      if (!q) return;
      setCurrentQuestion(q);
      const saved = answersByQuestionId[q.id];
      if (q.type === 'multiple') {
        setCurrentAnswer(Array.isArray(saved) ? saved : []);
        setAnswerType('multiple');
      } else if (q.type === 'single') {
        setCurrentAnswer(typeof saved === 'string' ? saved : '');
        setAnswerType('single');
      } else {
        setCurrentAnswer(typeof saved === 'string' ? saved : '');
        setAnswerType('text');
      }
      return;
    }
    // 历史已到最后一题，且达到题量上限，则不再获取新题
    if (questionHistory.length >= questionCount) {
      return;
    }
    // 否则获取新题并追加到历史
    fetchNextQuestion(practiceSession.id, false, true);
  };

  const endPractice = async () => {
    if (!practiceSession) {
      setIsPracticing(false);
      return;
    }
    setIsPracticing(false);
    await fetchPracticeResult(practiceSession.id);
  };

  const endStudyMode = () => {
    setStudyMode(false);
    setSubmitOpen(false);
    setIsPracticing(false);
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedChapterId('');
  };

  const renderTopicTree = () => null;

  if (isPracticing && listMode) {
    const singles = allQuestions.filter(q => q.type === 'single');
    const multiples = allQuestions.filter(q => q.type === 'multiple');
    const fills = allQuestions.filter(q => q.type === 'fill');
    const subjectives = allQuestions.filter(q => q.type === 'subjective');
    const answeredNum = allQuestions.filter(q => answersByQuestionId[q.id] !== undefined).length;
    const renderOptionLabelClass = (question: Question, optionId: string) => {
      if (!studyMode) return 'flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer';
      const correct = Array.isArray(question.answer)
        ? (question.answer as string[]).includes(optionId)
        : question.answer === optionId;
      return correct ? 'flex items-start gap-3 p-3 border rounded-lg bg-green-50 border-green-400' : 'flex items-start gap-3 p-3 border rounded-lg';
    };
    const renderSection = (title: string, list: Question[]) => (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
        <div className="space-y-4">
          {list.map(q => (
            <div key={q.id} className="border rounded-none sm:rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{getTypeLabel(q.type)}</span>
              </div>
              <div className="bg-gray-50 rounded p-3 mb-3">
                <MathRenderer content={q.content} />
              </div>
              {gradingMode && (
                (() => {
                  const ua = answersByQuestionId[q.id];
                  const ok = Array.isArray(q.answer)
                    ? Array.isArray(ua) && (ua as string[]).length === (q.answer as string[]).length && (q.answer as string[]).every(a => (ua as string[]).includes(a))
                    : typeof ua === 'string' && String(ua).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
                  return (
                    <div className="mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ok ? '正确' : '错误'}</span>
                    </div>
                  );
                })()
              )}
              {q.type === 'single' && q.options && (
                <div className="space-y-3">
                  {q.options.map(option => (
                    <label key={option.id} className={renderOptionLabelClass(q, option.id)}>
                      <input
                        type="radio"
                        name={`answer-${q.id}`}
                        value={option.id}
                        checked={answersByQuestionId[q.id] === option.id}
                        onChange={(e) => { const val = e.target.value; setAnswersByQuestionId(prev => ({ ...prev, [q.id]: val })); }}
                        className="sr-only"
                        disabled={studyMode || gradingMode}
                      />
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full border ${ (studyMode || gradingMode) ? ((!Array.isArray(q.answer) && q.answer === option.id) ? 'border-green-400 bg-green-500 text-white' : (answersByQuestionId[q.id] === option.id && gradingMode ? 'border-red-500 bg-red-600 text-white' : 'border-gray-300 bg-white text-gray-700')) : (answersByQuestionId[q.id] === option.id ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700')} flex items-center justify-center text-sm font-medium`}>{option.id}</span>
                      <div className="text-gray-700 flex-1"><MathRenderer content={option.content} /></div>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'multiple' && q.options && (
                <div className="space-y-3">
                  {q.options.map(option => {
                    const current = Array.isArray(answersByQuestionId[q.id]) ? (answersByQuestionId[q.id] as string[]) : [];
                    return (
                      <label key={option.id} className={renderOptionLabelClass(q, option.id)}>
                        <input
                          type="checkbox"
                          value={option.id}
                          checked={current.includes(option.id)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...current, option.id] : current.filter(id => id !== option.id);
                            setAnswersByQuestionId(prev => ({ ...prev, [q.id]: next }));
                          }}
                          className="sr-only"
                          disabled={studyMode || gradingMode}
                        />
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full border ${ (studyMode || gradingMode) ? ((Array.isArray(q.answer) && (q.answer as string[]).includes(option.id)) ? 'border-green-400 bg-green-500 text-white' : ((Array.isArray(answersByQuestionId[q.id]) && (answersByQuestionId[q.id] as string[]).includes(option.id) && gradingMode) ? 'border-red-500 bg-red-600 text-white' : 'border-gray-300 bg-white text-gray-700')) : ((Array.isArray(answersByQuestionId[q.id]) && (answersByQuestionId[q.id] as string[]).includes(option.id)) ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700')} flex items-center justify-center text-sm font-medium`}>{option.id}</span>
                        <div className="text-gray-700 flex-1"><MathRenderer content={option.content} /></div>
                      </label>
                    );
                  })}
                </div>
              )}
              {(q.type === 'fill' || q.type === 'subjective') && (
                <div>
                  <textarea
                    value={typeof answersByQuestionId[q.id] === 'string' ? (answersByQuestionId[q.id] as string) : ''}
                    onChange={(e) => { const val = e.target.value; setAnswersByQuestionId(prev => ({ ...prev, [q.id]: val })); }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder={q.type === 'fill' ? '请输入答案' : '请输入主观题答案'}
                    rows={q.type === 'subjective' ? 6 : 3}
                    disabled={studyMode || gradingMode}
                  />
                  {gradingMode && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-400 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-1">参考答案</div>
                      <MathRenderer content={String(q.answer || '')} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <>
      <div className="w-full mx-auto px-0 sm:px-6 lg:px-8">
        <div className="bg-white rounded-none sm:rounded-lg shadow-lg p-3 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">练习进行中</h2>
            <button onClick={() => setIsPracticing(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 sm:w-6 h-5 sm:h-6" />
            </button>
          </div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-sm text-gray-500">已答 {answeredNum} / 总题 {questionCount}</span>
            <label className="inline-flex items-center space-x-2">
              <input type="checkbox" checked={studyMode} onChange={(e) => setStudyMode(e.target.checked)} />
              <span className="text-sm text-gray-700">背题模式</span>
            </label>
          </div>
          {singles.length > 0 && renderSection('单选题', singles)}
          {multiples.length > 0 && renderSection('多选题', multiples)}
          {fills.length > 0 && renderSection('填空题', fills)}
          {subjectives.length > 0 && renderSection('主观题', subjectives)}
          <div className="flex justify-end space-x-3 mt-4">
            {!studyMode && (
              <button onClick={() => setSubmitOpen(true)} className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">提交答案</button>
            )}
            <button onClick={() => setExitOpen(true)} className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">退出练习</button>
          </div>
        </div>
      </div>
      {submitOpen && !studyMode && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">提交确认</h3>
            <p className="text-sm text-gray-700 mb-2">将提交本次练习已答题目。未答题将按空白处理。</p>
            <p className="text-sm text-gray-700 mb-4">已答 {answeredNum} / {questionCount}</p>
            <label className="flex items-center space-x-2 mb-4">
              <input type="checkbox" checked={confirmSubmit} onChange={(e) => setConfirmSubmit(e.target.checked)} />
              <span className="text-sm text-gray-700">我已确认上述说明</span>
            </label>
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setSubmitOpen(false); setConfirmSubmit(false); }} className="px-4 py-2 border border-gray-300 rounded text-gray-700">取消</button>
              <button
                onClick={async () => {
                  if (!practiceSession) return;
                  const answers = allQuestions.map(q => ({ questionId: q.id, userAnswer: answersByQuestionId[q.id] })).filter(a => a.userAnswer !== undefined);
                  setLoading(true);
                  try {
                    const response = await fetch(`${API_HOST}/api/practice/submit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authService.getToken() || ''}` },
                      body: JSON.stringify({ practiceId: practiceSession.id, answers, completed: true })
                    });
                    let data: any = { success: false };
                    try { data = await response.json(); } catch {}
                    if (data.success) {
                      setSubmitOpen(false);
                      setConfirmSubmit(false);
                      setStudyMode(true);
                      setIsPracticing(true);
                    }
                  } catch (e) {
                    console.error('提交答案失败:', e);
                  } finally { setLoading(false); }
                }}
                disabled={ loading || ( (!confirmSubmit) && (answeredNum < questionCount) ) }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
      {exitOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">退出练习</h3>
            <p className="text-sm text-gray-700 mb-4">是否保存进度？保存将提交已答题目并进入回顾。</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setExitOpen(false); setIsPracticing(false); setStudyMode(false); setGradingMode(false); setAnswersByQuestionId({}); setQuestionHistory([]); setCurrentIndex(0); setCurrentQuestion(null); setPracticeSession(null); setAllQuestions([]); }} className="px-4 py-2 border border-gray-300 rounded text-gray-700">不保存退出</button>
              <button
                onClick={async () => {
                  if (!practiceSession) return;
                  const answers = allQuestions.map(q => ({ questionId: q.id, userAnswer: answersByQuestionId[q.id] })).filter(a => a.userAnswer !== undefined);
                  setLoading(true);
                  try {
                    const response = await fetch(`${API_HOST}/api/practice/submit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authService.getToken() || ''}` },
                      body: JSON.stringify({ practiceId: practiceSession.id, answers, completed: true })
                    });
                    let data: any = { success: false };
                    try { data = await response.json(); } catch {}
                    setExitOpen(false);
                    setIsPracticing(false);
                    setStudyMode(false);
                    setGradingMode(false);
                  } catch (e) {
                    console.error('保存并退出失败:', e);
                  } finally { setLoading(false); }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存并退出
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  if (isPracticing && currentQuestion) {
    return (
      <>
      <div className="w-full mx-auto px-0 sm:px-6 lg:px-8">
        <div className="bg-white rounded-none sm:rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">练习进行中</h2>
            <button
              onClick={() => setIsPracticing(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 sm:w-6 h-5 sm:h-6" />
            </button>
          </div>

          <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-sm text-gray-500">
              题目 {currentIndex + 1} / {questionCount}
            </span>
            <label className="inline-flex items-center space-x-2">
              <input type="checkbox" checked={studyMode} onChange={(e) => setStudyMode(e.target.checked)} />
              <span className="text-sm text-gray-700">背题模式</span>
            </label>
          </div>

            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{getTypeLabel(currentQuestion.type)}</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="prose max-w-none">
                <MathRenderer content={currentQuestion.content} />
              </div>
            </div>
            {studyMode && (
              (() => {
                const ua = currentAnswer;
                const ok = Array.isArray(currentQuestion.answer)
                  ? Array.isArray(ua) && (ua as string[]).length === (currentQuestion.answer as string[]).length && (currentQuestion.answer as string[]).every(a => (ua as string[]).includes(a))
                  : typeof ua === 'string' && String(ua).trim().toLowerCase() === String(currentQuestion.answer).trim().toLowerCase();
                return (
                  <div className="mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ok ? '正确' : '错误'}</span>
                  </div>
                );
              })()
            )}

            {currentQuestion.type === 'single' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map(option => {
                  const correct = !Array.isArray(currentQuestion.answer) && currentQuestion.answer === option.id;
                  const selected = currentAnswer === option.id;
                  const labelClass = studyMode && correct
                    ? 'flex items-start gap-3 p-3 border rounded-lg bg-green-50 border-green-400'
                    : 'flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer';
                  const circleClass = studyMode
                    ? (correct
                      ? 'flex-shrink-0 w-8 h-8 rounded-full border border-green-400 bg-green-500 text-white flex items-center justify-center text-sm font-medium'
                      : (selected ? 'flex-shrink-0 w-8 h-8 rounded-full border border-red-500 bg-red-600 text-white flex items-center justify-center text-sm font-medium' : 'flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-700 flex items-center justify-center text-sm font-medium'))
                    : (selected
                      ? 'flex-shrink-0 w-8 h-8 rounded-full border border-blue-500 bg-blue-600 text-white flex items-center justify-center text-sm font-medium'
                      : 'flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-700 flex items-center justify-center text-sm font-medium');
                  return (
                    <label key={option.id} className={labelClass}>
                      <input
                        type="radio"
                        name="answer"
                        value={option.id}
                        checked={currentAnswer === option.id}
                        onChange={(e) => { const val = e.target.value; setCurrentAnswer(val); setAnswersByQuestionId(prev => currentQuestion ? { ...prev, [currentQuestion.id]: val } : prev); }}
                        className="sr-only"
                        disabled={studyMode}
                      />
                      <span className={circleClass}>{option.id}</span>
                      <div className="text-gray-700 flex-1"><MathRenderer content={option.content} /></div>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'multiple' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map(option => {
                  const correct = Array.isArray(currentQuestion.answer) && (currentQuestion.answer as string[]).includes(option.id);
                  const selected = (currentAnswer as string[]).includes(option.id);
                  const labelClass = studyMode && correct
                    ? 'flex items-start gap-3 p-3 border rounded-lg bg-green-50 border-green-400'
                    : 'flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer';
                  const circleClass = studyMode
                    ? (correct
                      ? 'flex-shrink-0 w-8 h-8 rounded-full border border-green-400 bg-green-500 text-white flex items-center justify-center text-sm font-medium'
                      : (selected ? 'flex-shrink-0 w-8 h-8 rounded-full border border-red-500 bg-red-600 text-white flex items-center justify-center text-sm font-medium' : 'flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-700 flex items-center justify-center text-sm font-medium'))
                    : (selected
                      ? 'flex-shrink-0 w-8 h-8 rounded-full border border-blue-500 bg-blue-600 text-white flex items-center justify-center text-sm font-medium'
                      : 'flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-700 flex items-center justify-center text-sm font-medium');
                  return (
                    <label key={option.id} className={labelClass}>
                      <input
                        type="checkbox"
                        value={option.id}
                        checked={(currentAnswer as string[]).includes(option.id)}
                        onChange={(e) => {
                          const currentAnswers = currentAnswer as string[];
                          const next = e.target.checked ? [...currentAnswers, option.id] : currentAnswers.filter(id => id !== option.id);
                          setCurrentAnswer(next);
                          setAnswersByQuestionId(prev => currentQuestion ? { ...prev, [currentQuestion.id]: next } : prev);
                        }}
                        className="sr-only"
                        disabled={studyMode}
                      />
                      <span className={circleClass}>{option.id}</span>
                      <div className="text-gray-700 flex-1"><MathRenderer content={option.content} /></div>
                    </label>
                  );
                })}
              </div>
            )}

            {(currentQuestion.type === 'fill' || currentQuestion.type === 'subjective') && (
              <div>
                <textarea
                  value={currentAnswer as string}
                  onChange={(e) => { const val = e.target.value; setCurrentAnswer(val); setAnswersByQuestionId(prev => currentQuestion ? { ...prev, [currentQuestion.id]: val } : prev); }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder={currentQuestion.type === 'fill' ? '请输入答案' : '请输入主观题答案'}
                  rows={currentQuestion.type === 'subjective' ? 6 : 3}
                  disabled={studyMode}
                />
                {studyMode && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-400 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-1">参考答案</div>
                    <MathRenderer content={String(currentQuestion.answer || '')} />
                  </div>
                )}
              </div>
            )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={goPrevQuestion}
              disabled={currentIndex === 0}
              className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              上一题
            </button>
            {!studyMode && (
              <button
                onClick={() => setSubmitOpen(true)}
                className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                提交答案
              </button>
            )}
            <button
              onClick={() => setExitOpen(true)}
              className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              退出练习
            </button>
            <button
              onClick={goNextQuestion}
              disabled={loading || (currentIndex >= questionHistory.length - 1 && questionHistory.length >= questionCount)}
              className="px-4 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              下一题
            </button>
          </div>
        </div>
      </div>
      {submitOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">提交确认</h3>
            <p className="text-sm text-gray-700 mb-2">将提交本次练习已答题目。未答题将按空白处理。</p>
            <p className="text-sm text-gray-700 mb-4">已答 {questionHistory.filter(q => answersByQuestionId[q.id] !== undefined).length} / {questionCount}</p>
            <label className="flex items-center space-x-2 mb-4">
              <input type="checkbox" checked={confirmSubmit} onChange={(e) => setConfirmSubmit(e.target.checked)} />
              <span className="text-sm text-gray-700">我已确认上述说明</span>
            </label>
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setSubmitOpen(false); setConfirmSubmit(false); }} className="px-4 py-2 border border-gray-300 rounded text-gray-700">取消</button>
              <button
                onClick={async () => {
                  if (!practiceSession) return;
                  const answers = questionHistory
                    .map(q => ({ questionId: q.id, userAnswer: answersByQuestionId[q.id] }))
                    .filter(a => a.userAnswer !== undefined);
                  setLoading(true);
                  try {
                    const response = await fetch(`${API_HOST}/api/practice/submit`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authService.getToken() || ''}`
                      },
                      body: JSON.stringify({ practiceId: practiceSession.id, answers, completed: true })
                    });
                    let data: any = { success: false };
                    try { data = await response.json(); } catch {}
                    if (data.success) {
                      setSubmitOpen(false);
                      setConfirmSubmit(false);
                      setIsPracticing(false);
                      await fetchPracticeResult(practiceSession.id);
                    }
                  } catch (e) {
                    console.error('提交全部答案失败:', e);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={
                  loading || (
                    !confirmSubmit && (questionHistory.filter(q => answersByQuestionId[q.id] !== undefined).length < questionCount)
                  )
                }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
      {exitOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">退出练习</h3>
            <p className="text-sm text-gray-700 mb-4">是否保存进度？保存将提交已答题目并进入回顾。</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setExitOpen(false); setIsPracticing(false); }} className="px-4 py-2 border border-gray-300 rounded text-gray-700">不保存退出</button>
              <button
                onClick={async () => {
                  if (!practiceSession) return;
                  const answers = questionHistory.map(q => ({ questionId: q.id, userAnswer: answersByQuestionId[q.id] })).filter(a => a.userAnswer !== undefined);
                  setLoading(true);
                  try {
                    const response = await fetch(`${API_HOST}/api/practice/submit`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authService.getToken() || ''}`
                      },
                      body: JSON.stringify({ practiceId: practiceSession.id, answers, completed: true })
                    });
                    let data: any = { success: false };
                    try { data = await response.json(); } catch {}
                    setExitOpen(false);
                    setIsPracticing(false);
                    await fetchPracticeResult(practiceSession.id);
                  } catch (e) {
                    console.error('保存并退出失败:', e);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存并退出
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  if (isReviewing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">练习回顾</h2>
            <button
              onClick={() => setIsReviewing(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 sm:w-6 h-5 sm:h-6" />
            </button>
          </div>

          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm text-gray-500">
                正确 {reviewStats.correct} / 已答 {reviewStats.total} ，总题 {reviewStats.totalQuestions}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {reviewResults.map((item, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {item.isCorrect ? '正确' : '错误'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded p-3 mb-3">
                  <MathRenderer content={item.question?.content || ''} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">你的答案</div>
                    {Array.isArray(item.userAnswer) ? (
                      <div className="space-y-1">
                        {item.userAnswer.map((aid: string) => (
                          <div key={aid} className="text-gray-800">
                            {aid}. <MathRenderer content={(item.question?.options || []).find((o: any) => o.id === aid)?.content || aid} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-800">
                        {item.question?.options ? (
                          <>
                            {item.userAnswer}. <MathRenderer content={(item.question?.options || []).find((o: any) => o.id === item.userAnswer)?.content || String(item.userAnswer || '')} />
                          </>
                        ) : (
                          <MathRenderer content={String(item.userAnswer || '')} />
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">参考答案</div>
                    {Array.isArray(item.correctAnswer) ? (
                      <div className="space-y-1">
                        {item.correctAnswer.map((cid: string) => (
                          <div key={cid} className="text-gray-800">
                            {cid}. <MathRenderer content={(item.question?.options || []).find((o: any) => o.id === cid)?.content || cid} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-800">
                        {item.question?.options ? (
                          <>
                            {item.correctAnswer}. <MathRenderer content={(item.question?.options || []).find((o: any) => o.id === item.correctAnswer)?.content || String(item.correctAnswer || '')} />
                          </>
                        ) : (
                          <MathRenderer content={String(item.correctAnswer || '')} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setIsReviewing(false)}
              className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              返回练习中心
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">练习中心</h1>
        <p className="text-gray-600">选择专题，开始个性化练习</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">选择练习章节</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">课程</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">请选择科目</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">章节</label>
                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  disabled={!selectedSubjectId}
                >
                  <option value="">请选择章节</option>
                  {chapters(selectedSubjectId).map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">练习设置</h3>
            <p className="text-sm text-gray-600">将练习所选章节的全部题目</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">练习统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">已选课程:</span>
                <span className="font-medium">{selectedSubjectId ? (subjects.find(s => s.id === selectedSubjectId)?.name || '-') : '未选择'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">已选章节:</span>
                <span className="font-medium">{selectedChapterId ? (topics.find(t => t.id === selectedChapterId)?.name || '-') : '未选择'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">题目数量:</span>
                <span className="font-medium">{questionCount}题</span>
              </div>
              
            </div>
          </div>

          <button
            onClick={startPractice}
            disabled={loading || !selectedSubjectId || !selectedChapterId}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <Play className="mr-2 h-5 w-5" />
            {loading ? '准备中...' : '开始练习'}
          </button>

          <button
            onClick={async () => { const next = !showHistory; setShowHistory(next); if (next) await fetchHistory(); }}
            className="w-full bg-gray-100 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {showHistory ? '隐藏练习记录' : '查看练习记录'}
          </button>

          {showHistory && (
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">练习记录</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">时间</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">答题数</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">正确数</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map((s: any) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{new Date(s.startTime).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{s.totalQuestions}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{s.correctCount || 0}</td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={async () => { await fetchPracticeResult(s.id); }}
                            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>暂无记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {submitOpen && !studyMode && (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-3">提交确认</h3>
          <p className="text-sm text-gray-700 mb-2">将提交本次练习的所有已答题目。未答题将按空白处理。</p>
          <p className="text-sm text-gray-700 mb-4">已答 {questionHistory.filter(q => answersByQuestionId[q.id] !== undefined).length} / {questionCount}</p>
          <label className="flex items-center space-x-2 mb-4">
            <input type="checkbox" checked={confirmSubmit} onChange={(e) => setConfirmSubmit(e.target.checked)} />
            <span className="text-sm text-gray-700">我已确认上述说明</span>
          </label>
          <div className="flex justify-end space-x-2">
            <button onClick={() => { setSubmitOpen(false); setConfirmSubmit(false); }} className="px-4 py-2 border border-gray-300 rounded text-gray-700">取消</button>
            <button
              onClick={async () => {
                if (!confirmSubmit || !practiceSession) return;
                const answers = questionHistory
                  .map(q => ({ questionId: q.id, userAnswer: answersByQuestionId[q.id] }))
                  .filter(a => a.userAnswer !== undefined);
                setLoading(true);
                try {
                  const response = await fetch(`${API_HOST}/api/practice/submit`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${authService.getToken() || ''}`
                    },
                    body: JSON.stringify({ practiceId: practiceSession.id, answers, completed: true })
                  });
                  let data: any = { success: false };
                  try { data = await response.json(); } catch {}
                  if (data.success) {
                    setSubmitOpen(false);
                    setConfirmSubmit(false);
                    setIsPracticing(false);
                    await fetchPracticeResult(practiceSession.id);
                  }
                } catch (e) {
                  console.error('提交全部答案失败:', e);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={
                loading || (
                  !confirmSubmit && (questionHistory.filter(q => answersByQuestionId[q.id] !== undefined).length < questionCount)
                )
              }
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '提交中...' : '确认提交'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
