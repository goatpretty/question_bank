import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { usePracticeDraft } from '../hooks/usePracticeDraft';
import { useAuthStore } from '../stores/auth';
import { useState, useEffect, useRef } from 'react';
import { BookOpen, Play, X } from 'lucide-react';
import { questionService } from '../services/questionService';
import { practiceService } from '../services/practiceService';
import Memorization from '../components/Memorization';
import PracticeAnswerCard from '../components/PracticeAnswerCard';
import QuestionBrowser from '../components/QuestionBrowser';
import MathRenderer from '../components/MathRenderer';
import AIChatButton from '../components/ai/AIChatButton';
import AIChatPanel from '../components/ai/AIChatPanel';

function reviewOptionLabel(options: { id: string }[] | undefined, id: string) {
  const index = options?.findIndex(option => option.id === id) ?? -1;
  return index < 0 ? '未知选项' : String.fromCharCode(65 + index);
}

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

function PracticeOverlay({ children }: { children: ReactNode }) {
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="练习确认"
      className="fixed inset-0 w-screen z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      {children}
    </div>,
    document.body,
  );
}

function isAnswered(answer: unknown): boolean {
  return Array.isArray(answer)
    ? answer.some(value => typeof value === 'string' && value.trim().length > 0)
    : typeof answer === 'string' && answer.trim().length > 0;
}

export default function Practice() {
  const userId = useAuthStore(state => state.user?.id);
  return <PracticeWorkspace key={userId || 'guest'} userId={userId} />;
}

const initialDraft = {
  selectedSubjectId: '' as string,
  selectedChapterId: '' as string,
  questionCount: 0,
  answeredCount: 0,
  questionHistory: [] as any[],
  currentIndex: 0,
  answersByQuestionId: {} as Record<string, string | string[]>,
  isReviewing: false,
  reviewResults: [] as any[],
  reviewStats: { total: 0, correct: 0, totalQuestions: 0 } as { total: number; correct: number; totalQuestions: number },
  isPracticing: false,
  currentQuestion: null as Question | null,
  currentAnswer: '' as string | string[],
  answerType: 'text' as 'single' | 'multiple' | 'text',
  practiceSession: null as any,
  listMode: false,
  allQuestions: [] as Question[],
};

function PracticeWorkspace({ userId }: { userId?: string }) {
  const { field: draftField, restored, storageWarning } = usePracticeDraft(userId, initialDraft);
  const retryActions = useRef<Record<string, () => void>>({});
  const [notice, setNotice] = useState<{ message: string; retry?: () => void; tone: 'success' | 'warning' } | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const notify = (message: string, retry?: () => void, tone: 'success' | 'warning' = 'warning') => setNotice({ message, retry, tone });

  const [topics, setTopics] = useState<Topic[]>([]);
  const subjects = topics.filter(t => !t.parentId);
  const chapters = (subjectId: string | null | string) => topics.filter(t => t.parentId === (subjectId || null));
  const [selectedSubjectId, setSelectedSubjectId] = draftField('selectedSubjectId');
  const [selectedChapterId, setSelectedChapterId] = draftField('selectedChapterId');
  const [questionCount, setQuestionCount] = draftField('questionCount');
  const [answeredCount, setAnsweredCount] = draftField('answeredCount');
  const [questionHistory, setQuestionHistory] = draftField('questionHistory');
  const [currentIndex, setCurrentIndex] = draftField('currentIndex');
  const [answersByQuestionId, setAnswersByQuestionId] = draftField('answersByQuestionId');
  const [isReviewing, setIsReviewing] = draftField('isReviewing');
  const [reviewResults, setReviewResults] = draftField('reviewResults');
  const [reviewStats, setReviewStats] = draftField('reviewStats');
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [memorizationQuestions, setMemorizationQuestions] = useState<Question[] | null>(null);
  const [memorizationLoading, setMemorizationLoading] = useState(false);

  const startMemorization = async () => {
    if (!selectedSubjectId || !selectedChapterId || memorizationLoading) return;
    setNotice(null);
    setMemorizationLoading(true);
    try {
      const questions: Question[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const { data } = await questionService.getAllQuestions({ topicId: selectedChapterId.trim(), page, limit: 100 }, true);
        questions.push(...data.questions);
        totalPages = data.totalPages ?? Math.ceil(data.total / 100);
        page++;
      } while (page <= totalPages);
      if (!questions.length) {
        notify('该章节暂无题目，无法进入背题模式');
        return;
      }
      setMemorizationQuestions(questions);
    } catch {
      notify('背题题目加载失败，请重试。', startMemorization);
    } finally {
      setMemorizationLoading(false);
    }
  };

  useEffect(() => {
    if (restored && practiceSession?.id) return;
    const fetchCount = async () => {
      if (!selectedChapterId) {
        setQuestionCount(0);
        return;
      }
      try {
        const data = await questionService.getAllQuestions({ topicId: selectedChapterId, page: 1, limit: 1 }, true);
        const total = data?.data?.total ?? 0;
        setQuestionCount(total);
      } catch {
        notify('题量加载失败，请重试。', fetchCount);
      }
    };
    fetchCount();
  }, [selectedChapterId]);
  const [isPracticing, setIsPracticing] = draftField('isPracticing');
  const [currentQuestion, setCurrentQuestion] = draftField('currentQuestion');
  const [currentAnswer, setCurrentAnswer] = draftField('currentAnswer');
  const [answerType, setAnswerType] = draftField('answerType');
  const [practiceSession, setPracticeSession] = draftField('practiceSession');
  const [loading, setLoading] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [listMode, setListMode] = draftField('listMode');
  const [allQuestions, setAllQuestions] = draftField('allQuestions');
  const [exitOpen, setExitOpen] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const navigationBusy = useRef(false);
  const [navigationLoading, setNavigationLoading] = useState(false);

  const fetchChapterQuestions = async () => {
    const questions: Question[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const { data } = await questionService.getAllQuestions({ topicId: selectedChapterId.trim(), page, limit: 100 }, true);
      questions.push(...data.questions);
      totalPages = data.totalPages ?? Math.ceil(data.total / 100);
      page++;
    } while (page <= totalPages);
    return questions;
  };

  const loadNavigationQuestions = async (existing: Question[]) => {
    setNavigationLoading(true);
    try {
      const questions = await fetchChapterQuestions();
      setQuestionHistory(previous => {
        const loaded = previous.length ? previous : existing;
        const knownIds = new Set(loaded.map(question => question.id));
        return [...loaded, ...questions.filter(question => !knownIds.has(question.id))];
      });
    } catch {
      notify('答题卡加载失败，当前答案已保留，请重试。', () => loadNavigationQuestions(existing));
    } finally {
      setNavigationLoading(false);
    }
  };

  const showQuestion = (index: number, answers = effectiveAnswers) => {
    const question = questionHistory[index];
    if (!question) return;
    setCurrentIndex(index);
    setCurrentQuestion(question);
    const saved = answers[question.id];
    setCurrentAnswer(question.type === 'multiple' ? (Array.isArray(saved) ? saved : []) : (typeof saved === 'string' ? saved : ''));
    setAnswerType(question.type === 'single' || question.type === 'multiple' ? question.type : 'text');
  };

  const jumpToQuestion = (index: number) => {
    if (loading || navigationBusy.current || navigationLoading) return;
    setAnswersByQuestionId(effectiveAnswers);
    showQuestion(index);
    setNotice(null);
  };

  const focusListQuestion = (index: number) => {
    const question = allQuestions[index];
    if (!question) return;
    setCurrentIndex(index);
    window.requestAnimationFrame(() => document.getElementById('practice-question-' + question.id)?.scrollIntoView?.({ block: 'start' }));
  };

  useEffect(() => {
    if (isPracticing && listMode && allQuestions.length) focusListQuestion(currentIndex);
  }, [isPracticing, listMode]);


  const effectiveAnswers = !listMode && currentQuestion
    ? { ...answersByQuestionId, [currentQuestion.id]: currentAnswer }
    : answersByQuestionId;
  const hasAnyAnswer = Object.values(effectiveAnswers).some(isAnswered);

  const discardPractice = () => {
    setExitOpen(false);
    setSubmitOpen(false);
    setConfirmSubmit(false);
    setIsPracticing(false);
    setIsReviewing(false);
    setAnswersByQuestionId({});
    setQuestionHistory([]);
    setCurrentIndex(0);
    setCurrentQuestion(null);
    setCurrentAnswer('');
    setPracticeSession(null);
    setAllQuestions([]);
    setNotice(null);
  };

  const requestExit = () => {
    if (loading) return;
    if (!hasAnyAnswer) discardPractice();
    else setExitOpen(true);
  };
  const requestSubmit = () => {
    if (hasAnyAnswer && !loading) setSubmitOpen(true);
  };

  useEffect(() => {
    if (!hasAnyAnswer) {
      setSubmitOpen(false);
      setConfirmSubmit(false);
      if (exitOpen) discardPractice();
    }
  }, [hasAnyAnswer, exitOpen]);

  const savePractice = async (...args: Parameters<typeof practiceService.submitPractice>) => {
    if (args[2] && !args[1].some(answer => isAnswered(answer.userAnswer))) {
      throw new Error('请至少作答一题后再提交');
    }
    const data = await practiceService.submitPractice(...args);
    if (!data.success) throw new Error(data.error || '提交失败，请重试');
    if (args[2]) setPracticeSession(previous => previous ? { ...previous, status: 'completed' } : previous);
    setNotice(null);
    return data;
  };

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if (!restored || !practiceSession?.id) return;
    let cancelled = false;
    const checkSession = async () => {
      try {
        const data = await practiceService.getSessionDetail(practiceSession.id);
        const session = (data.data as any)?.session;
        if (!data.success || !session) throw new Error('无法确认练习状态');
        if (cancelled) return;
        if (session.status !== 'in_progress') {
          setPracticeSession(null);
          setIsPracticing(false);
          notify('上次练习已结束，请从练习记录查看结果或重新开始。');
        } else if (!currentQuestion && !listMode) {
          await fetchNextQuestion(session.id, true, true);
        } else if (listMode && allQuestions.length === 0) {
          await loadPracticeList();
        } else if (!listMode && questionHistory.length < questionCount) {
          await loadNavigationQuestions(questionHistory);
        }
      } catch {
        if (!cancelled) notify('已恢复本地草稿，暂时无法确认服务器状态。可继续编辑，联网后请重试。', checkSession);
      }
    };
    checkSession();
    return () => { cancelled = true; };
  }, [practiceSession?.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const feedback = (
    <div id="practice-feedback" className="space-y-2 mb-4">
      {offline && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">当前处于离线状态，可继续编辑；联网后请主动重试提交。</p>}
      {storageWarning && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{storageWarning}</p>}
      {notice && createPortal(
        <div className="pointer-events-none fixed inset-0 w-screen z-[70] flex items-start justify-center px-4 pt-[max(6rem,14vh)] lg:pl-[20rem]">
          <div role="status" aria-live="polite" aria-atomic="true"
            className={`pointer-events-auto relative w-fit max-w-[calc(100vw-2rem)] rounded-2xl border py-5 pl-6 pr-10 text-left text-sm leading-relaxed shadow-2xl lg:max-w-[calc(100vw-24rem)] ${notice.tone === 'success'
              ? 'border-green-200 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100'
              : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-gray-800 dark:text-amber-100'}`}>
            <button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}
              className={`absolute right-2 top-2 rounded p-1 focus-visible:ring-2 ${notice.tone === 'success'
                ? 'text-green-800 hover:bg-green-100 focus-visible:ring-green-500 dark:text-green-200 dark:hover:bg-green-900'
                : 'text-amber-800 hover:bg-amber-100 focus-visible:ring-amber-500 dark:text-amber-200 dark:hover:bg-gray-700'}`}>
              <X className="h-4 w-4" />
            </button>
            <p className={notice.message.startsWith('进度已保存') ? 'sm:whitespace-nowrap' : 'break-words'}>{notice.message}</p>
            {notice.retry && <button type="button" onClick={() => { const retry = notice.retry; setNotice(null); retry?.(); }} className="mt-3 rounded-lg px-3 py-1 font-medium underline focus-visible:ring-2 focus-visible:ring-amber-500">重试</button>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );

  const hasPausedPractice = !!practiceSession && practiceSession.status !== 'completed' && !isPracticing && !isReviewing;

  const resumePractice = () => {
    setNotice(null);
    setIsPracticing(true);
  };

  const saveAndExit = async () => {
    if (!practiceSession || loading) return;
    const draftAnswers = { ...answersByQuestionId };
    if (!listMode && currentQuestion) draftAnswers[currentQuestion.id] = currentAnswer;
    const answers = Object.entries(draftAnswers)
      .filter(([, answer]) => isAnswered(answer))
      .map(([questionId, userAnswer]) => ({ questionId, userAnswer }));
    setLoading(true);
    try {
      // Reuse the incremental-save endpoint without completing this session.
      await savePractice(practiceSession.id, answers, false);
      setAnswersByQuestionId(draftAnswers);
      setExitOpen(false);
      setIsPracticing(false);
      setIsReviewing(false);
      notify('进度已保存，练习尚未提交。可点击“继续上次练习”接着作答。', undefined, 'success');
    } catch (error) {
      console.error('保存并退出失败:', error);
      const reason = error instanceof Error ? error.message : '未知错误';
      notify(`保存失败，答案仍保留在当前页面。请重试保存并退出。原因：${reason}`);
    } finally {
      setLoading(false);
    }
  };

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
      if (!restored) setListMode(isMobile);
    } catch { /* matchMedia 不可用时保持列表模式 */ }
  }, []);

  const fetchTopics = async () => {
    try {
      const data = await questionService.getTopics();
      if (!data.success) throw new Error('章节加载失败');
      setTopics(data.data);
    } catch (error) {
      console.error('获取章节失败:', error);
      notify('获取章节失败，答案保留在本机，请重试。', fetchTopics);
    }
  };

  const loadPracticeList = async (total = questionCount) => {
    try {
      const qs = await fetchChapterQuestions();
      const randomizedQs = qs.map(q => {
        if (q.options) {
          return {
            ...q,
            options: [...q.options].sort((a, b) => a.id.localeCompare(b.id))
          };
        }
        return q;
      });
      function shuffleArray<T>(array: T[], seed: number): T[] {
        const shuffled = [...array];
        let currentIndex = shuffled.length;
        let randomIndex;
        function getRandomInt(max: number): number {
          const x = Math.sin(seed++) * 10000;
          return Math.floor((x - Math.floor(x)) * max);
        }
        while (currentIndex > 0) {
          randomIndex = getRandomInt(currentIndex);
          currentIndex--;
          [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
        }
        return shuffled;
      }
      const seed = selectedChapterId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const singles = randomizedQs.filter(q => q.type === 'single');
      const multiples = randomizedQs.filter(q => q.type === 'multiple');
      const fills = randomizedQs.filter(q => q.type === 'fill');
      const subjectives = randomizedQs.filter(q => q.type === 'subjective');
      const ordered = [
        ...shuffleArray(singles, seed),
        ...shuffleArray(multiples, seed + 1),
        ...shuffleArray(fills, seed + 2),
        ...shuffleArray(subjectives, seed + 3)
      ];
      setAllQuestions(ordered);
      setQuestionCount(total || qs.length);
      setIsPracticing(true);
    } catch (e) {
      console.error('获取题目列表失败:', e);
      notify('获取题目列表失败，草稿仍保留，请重试。', () => loadPracticeList());
    }
  };

  const startPractice = async () => {
    setNotice(null);
    if (!selectedSubjectId || !selectedChapterId) {
      notify('请先选择科目与章节');
      return;
    }
    setAnsweredCount(0);
    setQuestionHistory([]);
    setCurrentIndex(0);
    setAnswersByQuestionId({});
    setCurrentQuestion(null);
    setCurrentAnswer('');
    setAnswerType('text');
    setPracticeSession(null);
    setAllQuestions([]);
    setIsReviewing(false);
    setReviewResults([]);
    setReviewStats({ total: 0, correct: 0, totalQuestions: 0 });
    setLoading(true);
    try {
      const chapter = (selectedChapterId || '').trim();
      const countData = await questionService.getAllQuestions({ topicId: chapter, page: 1, limit: 1 }, true);
      const total = countData?.data?.total ?? 0;
      setQuestionCount(total);
      if (total === 0) {
        notify('该章节暂无题目');
        setLoading(false);
        return;
      }
      const data = await practiceService.startPractice({
        topicIds: [(selectedChapterId || '').trim()],
        questionCount: total,
      });
      if (!data.success) throw new Error(data.error || '开始练习失败');
      if (data.success) {
        setPracticeSession(data.data);
        setAnsweredCount(0);
        if (listMode) {
          await loadPracticeList(total);
        } else {
          const firstQuestion = await fetchNextQuestion(data.data.id, true, true);
          if (firstQuestion) await loadNavigationQuestions([firstQuestion]);
        }
      }
    } catch (error) {
      console.error('开始练习失败:', error);
      notify('开始练习失败，答案保留在本机，请重试。', () => retryActions.current.startPractice());
    } finally {
      setLoading(false);
    }
  };

  const fetchNextQuestion = async (sessionId: string, firstLoad: boolean = false, pushToHistory: boolean = false) => {
    try {
      const data = await practiceService.getPracticeQuestion(sessionId);
      if (data.success) {
        const q = data.data;
        if (q.options) {
          q.options = [...q.options].sort((a, b) => a.id.localeCompare(b.id));
        }
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
        return q;
      } else {
        const errData = data as any;
        if (errData?.noMoreQuestions || (data.error && String(data.error).toLowerCase().includes('no more questions'))) {
          setIsPracticing(false);
          if (practiceSession?.id) {
            await fetchPracticeResult(practiceSession.id);
          }
          return;
        }
        if (firstLoad) {
          if (String(data.error || '').toLowerCase().includes('no questions available')) {
            notify('该章节暂无题目，无法开始练习');
            setIsPracticing(false);
            return;
          }
        }
        notify(data.error || '获取题目失败，请重试。', () => fetchNextQuestion(sessionId, firstLoad, pushToHistory));
      }
    } catch (error) {
      console.error('获取下一题失败:', error);
      notify('获取下一题失败，答案保留在本机，请重试。', () => fetchNextQuestion(sessionId, firstLoad, pushToHistory));
    }
  };

  const fetchPracticeResult = async (sessionId: string) => {
    try {
      const data = await practiceService.getSessionResult(sessionId);
      if (!data.success) throw new Error(data.error || '结果加载失败');
      if (data.success) {
        setReviewResults(data.data.results || []);
        setReviewStats({ total: data.data.total || 0, correct: data.data.correct || 0, totalQuestions: data.data.totalQuestions || 0 });
        setIsReviewing(true);
      }
    } catch (e) {
      console.error('获取练习结果失败:', e);
      notify('获取练习结果失败，请重试。', () => fetchPracticeResult(sessionId));
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await practiceService.getSessionHistory({ page: 1, limit: 20 });
      if (data.success) {
        setHistory(data.data.sessions || []);
      }
    } catch (e) {
      console.error('获取练习记录失败:', e);
      notify('获取练习记录失败，答案保留在本机，请重试。', fetchHistory);
    }
  };

  const submitAnswer = async () => {
    setNotice(null);
    if (!currentQuestion || !practiceSession) return;
    if (answerType === 'single' && !currentAnswer) {
      notify('请选择一个答案');
      return;
    }
    if (answerType === 'multiple' && (currentAnswer as string[]).length === 0) {
      notify('请至少选择一个答案');
      return;
    }
    if (answerType === 'text' && !(currentAnswer as string).trim()) {
      notify('请输入答案');
      return;
    }
    setLoading(true);
    try {
      const data = await savePractice(practiceSession.id, [{ questionId: currentQuestion.id, userAnswer: currentAnswer }], false);
      if (data.success) {
        setAnswersByQuestionId(prev => ({ ...prev, [currentQuestion.id]: currentAnswer }));
        setAnsweredCount(data.data.totalCount ?? answeredCount);
        if ((data.data.totalCount ?? 0) >= questionCount) {
          setIsPracticing(false);
          if (practiceSession?.id) {
            await fetchPracticeResult(practiceSession.id);
          }
        } else {
          await fetchNextQuestion(practiceSession.id, false, true);
        }
      }
    } catch (error) {
      console.error('提交答案失败:', error);
      notify('提交答案失败，答案保留在本机，请重试。', () => retryActions.current.submitAnswer());
    } finally {
      setLoading(false);
    }
  };

  const goPrevQuestion = () => {
    if (currentIndex > 0) jumpToQuestion(currentIndex - 1);
  };

  const goNextQuestion = async (answer: string | string[] = currentAnswer) => {
    if (!practiceSession || loading || navigationBusy.current || navigationLoading) return;
    navigationBusy.current = true;
    setLoading(true);
    try {
      if (currentQuestion && isAnswered(answer)) {
        try {
          await savePractice(practiceSession.id, [{ questionId: currentQuestion.id, userAnswer: answer }], false);
        } catch (e) {
          console.error('下一题保存答案失败:', e);
          notify('答案尚未同步，已保留在本机。请重试下一题。', () => retryActions.current.goNextQuestion());
          return;
        }
      }
      if (currentIndex < questionHistory.length - 1) {
        showQuestion(currentIndex + 1, currentQuestion ? { ...answersByQuestionId, [currentQuestion.id]: answer } : answersByQuestionId);
        return;
      }
      if (questionHistory.length >= questionCount) {
        return;
      }
      await fetchNextQuestion(practiceSession.id, false, true);
    } finally {
      navigationBusy.current = false;
      setLoading(false);
    }
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedChapterId('');
  };

  retryActions.current = { startPractice, submitAnswer, goNextQuestion };

  if (memorizationQuestions) {
    return <>{feedback}<Memorization questions={memorizationQuestions}
      chapterName={topics.find(topic => topic.id === selectedChapterId)?.name || ''}
      onClose={() => setMemorizationQuestions(null)} /></>;
  }

  if (isPracticing && listMode) {
    const singles = allQuestions.filter(q => q.type === 'single');
    const multiples = allQuestions.filter(q => q.type === 'multiple');
    const fills = allQuestions.filter(q => q.type === 'fill');
    const subjectives = allQuestions.filter(q => q.type === 'subjective');
    const answeredNum = allQuestions.filter(q => isAnswered(answersByQuestionId[q.id])).length;
    const renderOptionLabelClass = () => 'flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer';
    const renderSection = (title: string, list: Question[]) => (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
        <div className="space-y-4">
          {list.map(q => (
            <div key={q.id} id={`practice-question-${q.id}`} onFocusCapture={() => setCurrentIndex(allQuestions.findIndex(question => question.id === q.id))} className="scroll-mt-6 border border-gray-200 dark:border-gray-700 rounded-none sm:rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">{getTypeLabel(q.type)}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-3">
                <MathRenderer content={q.content} />
              </div>
              {q.type === 'single' && q.options && (
                <div className="space-y-3">
                  {[...q.options].sort((a, b) => a.id.localeCompare(b.id)).map((option, optionIndex) => (
                    <label key={option.id} className={renderOptionLabelClass()}>
                      <input
                        type="radio"
                        name={`answer-${q.id}`}
                        value={option.id}
                        checked={answersByQuestionId[q.id] === option.id}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnswersByQuestionId(prev => ({ ...prev, [q.id]: val }));
                          const index = allQuestions.findIndex(question => question.id === q.id);
                          if (index < allQuestions.length - 1) focusListQuestion(index + 1);
                        }}
                        className="sr-only"
                      />
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full border ${answersByQuestionId[q.id] === option.id
                          ? 'border-amber-500 bg-amber-600 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} flex items-center justify-center text-sm font-medium`}>{String.fromCharCode(65 + optionIndex)}</span>
                      <div className="text-gray-700 dark:text-gray-300 flex-1"><MathRenderer content={option.content} /></div>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'multiple' && q.options && (
                <div className="space-y-3">
                  {[...q.options].sort((a, b) => a.id.localeCompare(b.id)).map((option, optionIndex) => {
                    const current = Array.isArray(answersByQuestionId[q.id]) ? (answersByQuestionId[q.id] as string[]) : [];
                    return (
                      <label key={option.id} className={renderOptionLabelClass()}>
                        <input
                          type="checkbox"
                          value={option.id}
                          checked={current.includes(option.id)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...current, option.id] : current.filter(id => id !== option.id);
                            setAnswersByQuestionId(prev => ({ ...prev, [q.id]: next }));
                          }}
                          className="sr-only"
                        />
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full border ${current.includes(option.id)
                          ? 'border-amber-500 bg-amber-600 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} flex items-center justify-center text-sm font-medium`}>{String.fromCharCode(65 + optionIndex)}</span>
                        <div className="text-gray-700 dark:text-gray-300 flex-1"><MathRenderer content={option.content} /></div>
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
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    placeholder={q.type === 'fill' ? '请输入答案' : '请输入主观题答案'}
                    rows={q.type === 'subjective' ? 6 : 3}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <>
      {!submitOpen && !exitOpen && feedback}
      <div className="relative grid w-full min-w-0 mx-auto items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div data-ai-chat-boundary="practice" className="relative min-w-0 bg-white dark:bg-gray-800 rounded-none sm:rounded-lg shadow-lg p-3 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">练习进行中</h2>
            <button aria-label="退出练习" onClick={requestExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              <X className="w-5 sm:w-6 h-5 sm:h-6" />
            </button>
          </div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">已答 {answeredNum} / 总题 {questionCount}</span>
          </div>
          {singles.length > 0 && renderSection('单选题', singles)}
          {multiples.length > 0 && renderSection('多选题', multiples)}
          {fills.length > 0 && renderSection('填空题', fills)}
          {subjectives.length > 0 && renderSection('主观题', subjectives)}
          <div className="mt-4 flex items-center justify-between gap-3">
            <AIChatButton position="static" onClick={() => setShowAIChat(true)} />
            <div className="flex justify-end space-x-3">
              <button onClick={requestSubmit} disabled={!hasAnyAnswer || loading} className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 enabled:hover:bg-gray-50 dark:enabled:hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-500 dark:disabled:border-gray-700">提交答案</button>
              <button onClick={requestExit} className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">退出练习</button>
            </div>
          </div>
        </div>
        <PracticeAnswerCard questions={allQuestions} answers={answersByQuestionId} currentIndex={currentIndex}
          disabled={loading} onSelect={focusListQuestion} />
      </div>
      {submitOpen && (
        <PracticeOverlay>
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 border border-gray-200 dark:border-gray-600 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">提交确认</h3>
            {feedback}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">将提交本次练习已答题目。未答题将按空白处理。</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">已答 {answeredNum} / {questionCount}</p>
            {answeredNum < questionCount && (
              <label className="flex items-center space-x-2 mb-4">
                <input type="checkbox" checked={confirmSubmit} onChange={(e) => setConfirmSubmit(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">我已确认上述说明</span>
              </label>
            )}
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setSubmitOpen(false); setConfirmSubmit(false); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button
                onClick={async () => {
                  if (!practiceSession || !hasAnyAnswer) return;
                  const answers = allQuestions
                    .filter(q => isAnswered(answersByQuestionId[q.id]))
                    .map(q => ({
                      questionId: q.id,
                      userAnswer: answersByQuestionId[q.id]
                    }));
                  setLoading(true);
                  try {
                    const data = await savePractice(practiceSession.id, answers, true);
                    if (data.success) {
                      setSubmitOpen(false);
                      setConfirmSubmit(false);
                      setIsPracticing(false);
                      await fetchPracticeResult(practiceSession.id);
                    }
                  } catch (e) {
                    console.error('提交答案失败:', e);
                    notify('提交失败，答案仍保留。请再次点击确认提交重试。');
                  } finally { setLoading(false); }
                }}
                disabled={ !hasAnyAnswer || loading || (answeredNum < questionCount && !confirmSubmit) }
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </PracticeOverlay>
      )}
      {exitOpen && (
        <PracticeOverlay>
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 border border-gray-200 dark:border-gray-600 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">退出练习</h3>
            {feedback}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">保存当前答案与进度后返回练习中心，练习保持未完成，可稍后继续。只有“提交答案”才会结束练习。</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setExitOpen(false); setIsPracticing(false); setAnswersByQuestionId({}); setQuestionHistory([]); setCurrentIndex(0); setCurrentQuestion(null); setPracticeSession(null); setAllQuestions([]); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">不保存退出</button>
              <button
                onClick={saveAndExit}
                disabled={loading}
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
              >
                保存并退出
              </button>
            </div>
          </div>
        </PracticeOverlay>
      )}
      <AIChatPanel
        isOpen={showAIChat}
        onClose={() => setShowAIChat(false)}
        question={allQuestions[0] || null}
      />
      </>
    );
  }

  if (isPracticing && currentQuestion) {
    return (
      <>
      {!submitOpen && !exitOpen && feedback}
      <div className="relative grid w-full min-w-0 mx-auto items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div data-ai-chat-boundary="practice" className="relative min-w-0 bg-white dark:bg-gray-800 rounded-none sm:rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">练习进行中</h2>
            <button
              aria-label="退出练习" onClick={requestExit}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="w-5 sm:w-6 h-5 sm:h-6" />
            </button>
          </div>

          <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              题目 {currentIndex + 1} / {questionCount}
            </span>
          </div>

            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">{getTypeLabel(currentQuestion.type)}</span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="prose max-w-none dark:prose-invert">
                <MathRenderer content={currentQuestion.content} />
              </div>
            </div>

            {currentQuestion.type === 'single' && currentQuestion.options && (
              <div className="space-y-3">
                {[...currentQuestion.options].sort((a, b) => a.id.localeCompare(b.id)).map((option, optionIndex) => {
                  const selected = currentAnswer === option.id;
                  const labelClass = 'flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer';
                  const circleClass = `flex-shrink-0 w-8 h-8 rounded-full border ${selected
                    ? 'border-amber-500 bg-amber-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} flex items-center justify-center text-sm font-medium`;
                  return (
                    <label key={option.id} className={labelClass}>
                      <input
                        type="radio"
                        name="answer"
                        value={option.id}
                        checked={currentAnswer === option.id}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentAnswer(val);
                          setAnswersByQuestionId(prev => ({ ...prev, [currentQuestion.id]: val }));
                          if (currentIndex < questionHistory.length - 1) void goNextQuestion(val);
                        }}
                        disabled={loading || navigationLoading}
                        className="sr-only"
                      />
                      <span className={circleClass}>{String.fromCharCode(65 + optionIndex)}</span>
                      <div className="text-gray-700 dark:text-gray-300 flex-1"><MathRenderer content={option.content} /></div>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'multiple' && currentQuestion.options && (
              <div className="space-y-3">
                {[...currentQuestion.options].sort((a, b) => a.id.localeCompare(b.id)).map((option, optionIndex) => {
                  const selected = (currentAnswer as string[]).includes(option.id);
                  const labelClass = 'flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer';
                  const circleClass = `flex-shrink-0 w-8 h-8 rounded-full border ${selected
                    ? 'border-amber-500 bg-amber-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} flex items-center justify-center text-sm font-medium`;
                  return (
                    <label key={option.id} className={labelClass}>
                      <input
                        type="checkbox"
                        value={option.id}
                        checked={(currentAnswer as string[]).includes(option.id)}
                        disabled={loading || navigationLoading}
                        onChange={(e) => {
                          const currentAnswers = currentAnswer as string[];
                          const next = e.target.checked ? [...currentAnswers, option.id] : currentAnswers.filter(id => id !== option.id);
                          setCurrentAnswer(next);
                          setAnswersByQuestionId(prev => currentQuestion ? { ...prev, [currentQuestion.id]: next } : prev);
                        }}
                        className="sr-only"
                      />
                      <span className={circleClass}>{String.fromCharCode(65 + optionIndex)}</span>
                      <div className="text-gray-700 dark:text-gray-300 flex-1"><MathRenderer content={option.content} /></div>
                    </label>
                  );
                })}
              </div>
            )}

            {(currentQuestion.type === 'fill' || currentQuestion.type === 'subjective') && (
              <div>
                <textarea
                  value={currentAnswer as string}
                  disabled={loading || navigationLoading}
                  onChange={(e) => { const val = e.target.value; setCurrentAnswer(val); setAnswersByQuestionId(prev => currentQuestion ? { ...prev, [currentQuestion.id]: val } : prev); }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  placeholder={currentQuestion.type === 'fill' ? '请输入答案' : '请输入主观题答案'}
                  rows={currentQuestion.type === 'subjective' ? 6 : 3}
                />
              </div>
            )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <AIChatButton position="static" onClick={() => setShowAIChat(true)} />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                onClick={goPrevQuestion}
                disabled={currentIndex === 0 || loading || navigationLoading}
                className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 enabled:hover:bg-gray-50 dark:enabled:hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-500 dark:disabled:border-gray-700"
              >
                上一题
              </button>
                <button
                  onClick={requestSubmit} disabled={!hasAnyAnswer || loading}
                  className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 enabled:hover:bg-gray-50 dark:enabled:hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-500 dark:disabled:border-gray-700"
                >
                  提交答案
                </button>
              <button
                onClick={requestExit}
                className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                退出练习
              </button>
              <button
                onClick={() => void goNextQuestion()}
                disabled={loading || navigationLoading || (currentIndex >= questionHistory.length - 1 && questionHistory.length >= questionCount)}
                className="px-4 sm:px-6 py-2 border border-transparent bg-amber-500 text-white rounded-lg enabled:hover:bg-amber-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-500 dark:disabled:border-gray-700"
              >
                下一题
              </button>
            </div>
          </div>
        </div>
        <PracticeAnswerCard questions={questionHistory} answers={effectiveAnswers} currentIndex={currentIndex}
          disabled={loading || navigationLoading} onSelect={jumpToQuestion} />
      </div>
      {submitOpen && (
        <PracticeOverlay>
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 border border-gray-200 dark:border-gray-600 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">提交确认</h3>
            {feedback}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">将提交本次练习已答题目。未答题将按空白处理。</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">已答 {questionHistory.filter(q => isAnswered(answersByQuestionId[q.id])).length} / {questionCount}</p>
            {questionHistory.filter(q => isAnswered(answersByQuestionId[q.id])).length < questionCount && (
              <label className="flex items-center space-x-2 mb-4">
                <input type="checkbox" checked={confirmSubmit} onChange={(e) => setConfirmSubmit(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">我已确认上述说明</span>
              </label>
            )}
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setSubmitOpen(false); setConfirmSubmit(false); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button
                onClick={async () => {
                  if (!practiceSession || !hasAnyAnswer) return;
                  let currentAnswerToSubmit = null;
                  if (currentQuestion && currentAnswer !== '' && answersByQuestionId[currentQuestion.id] !== undefined) {
                    currentAnswerToSubmit = answersByQuestionId[currentQuestion.id];
                  }
                  const answeredQs = questionHistory
                    .filter(q => isAnswered(answersByQuestionId[q.id]))
                    .map(q => ({
                      questionId: q.id,
                      userAnswer: answersByQuestionId[q.id]
                    }));
                  if (currentQuestion && currentAnswerToSubmit !== null && !answeredQs.find(a => a.questionId === currentQuestion.id)) {
                    answeredQs.push({ questionId: currentQuestion.id, userAnswer: currentAnswerToSubmit });
                  }
                  const answers = answeredQs.length > 0 ? answeredQs : [];
                  setLoading(true);
                  try {
                    const data = await savePractice(practiceSession.id, answers, true);
                    if (data.success) {
                      setSubmitOpen(false);
                      setConfirmSubmit(false);
                      setIsPracticing(false);
                      await fetchPracticeResult(practiceSession.id);
                    }
                  } catch (e) {
                    console.error('提交全部答案失败:', e);
                    notify('提交失败，答案仍保留。请再次点击确认提交重试：' + (e instanceof Error ? e.message : '未知错误'));
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={ !hasAnyAnswer || loading || (questionHistory.filter(q => isAnswered(answersByQuestionId[q.id])).length < questionCount && !confirmSubmit) }
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </PracticeOverlay>
      )}
      {exitOpen && (
        <PracticeOverlay>
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 border border-gray-200 dark:border-gray-600 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">退出练习</h3>
            {feedback}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">保存当前答案与进度后返回练习中心，练习保持未完成，可稍后继续。只有“提交答案”才会结束练习。</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => {
                setAnswersByQuestionId({});
                setQuestionHistory([]);
                setCurrentAnswer('');
                setCurrentIndex(0);
                setCurrentQuestion(null);
                setPracticeSession(null);
                setAllQuestions([]);
                setIsPracticing(false);
                setExitOpen(false);
              }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">不保存退出</button>
              <button
                onClick={saveAndExit}
                disabled={loading}
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
              >保存并退出</button>
            </div>
          </div>
        </PracticeOverlay>
      )}
      <AIChatPanel
        isOpen={showAIChat}
        onClose={() => setShowAIChat(false)}
        question={currentQuestion}
      />
      </>
    );
  }

  if (isReviewing) {
    return (
      <>
      {!submitOpen && !exitOpen && feedback}
      <QuestionBrowser title="练习回顾" subtitle={`正确 ${reviewStats.correct} / 已答 ${reviewStats.total}，总题 ${reviewStats.totalQuestions}`}
        items={reviewResults.map((item, index) => ({ id: `${item.question?.id || index}-${index}`, status: !isAnswered(item.userAnswer) ? 'unanswered' : item.isCorrect ? 'correct' : 'incorrect' }))}
        onClose={() => setIsReviewing(false)}>
        <div data-ai-chat-boundary="practice" className="relative min-w-0">

          <div className="space-y-4">
            {reviewResults.map((item, idx) => {
              const displayQuestion = { ...item.question };
              if (displayQuestion?.options) {
                displayQuestion.options = [...displayQuestion.options].sort((a, b) => a.id.localeCompare(b.id));
              }
              return (
                <div key={idx} data-question-index={idx} tabIndex={-1} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.userAnswer === null ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : item.isCorrect ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                      {item.userAnswer === null ? '未作答' : item.isCorrect ? '正确' : '错误'}
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-3">
                    <MathRenderer content={displayQuestion?.content || ''} />
                  </div>
                  {displayQuestion?.options && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选项</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {displayQuestion.options.map((opt: any, optionIndex: number) => {
                          const isUserSelected = (Array.isArray(item.userAnswer) && item.userAnswer.includes(opt.id)) ||
                            (!Array.isArray(item.userAnswer) && item.userAnswer === opt.id);
                          const isCorrectAnswer = (Array.isArray(item.correctAnswer) && item.correctAnswer.includes(opt.id)) ||
                            (!Array.isArray(item.correctAnswer) && item.correctAnswer === opt.id);
                          const hasAnswered = item.userAnswer !== null;
                          const optionBorder = isUserSelected ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'border-gray-300 dark:border-gray-600';
                          const optionLabelColor = (hasAnswered && isCorrectAnswer) ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400';
                          return (
                            <div
                              key={opt.id}
                              className={`px-3 py-2 border rounded-md flex items-center gap-2 ${optionBorder}`}
                            >
                              <span className={`font-medium ${optionLabelColor}`}>{String.fromCharCode(65 + optionIndex)}.</span>
                              <MathRenderer content={opt.content} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">你的答案</div>
                      {item.userAnswer === null ? (
                        <div className="text-gray-600 dark:text-gray-400">
                          <span className="text-red-500 dark:text-red-400">未作答</span>
                        </div>
                      ) : Array.isArray(item.userAnswer) ? (
                        <div className="space-y-1">
                          {item.userAnswer.map((aid: string) => (
                            <div key={aid} className="text-gray-800 dark:text-gray-200">
                              {reviewOptionLabel(displayQuestion?.options, aid)}. <MathRenderer content={(displayQuestion?.options || []).find((o: any) => o.id === aid)?.content || aid} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-800 dark:text-gray-200">
                          {displayQuestion?.options ? (
                            <>
                              {reviewOptionLabel(displayQuestion?.options, item.userAnswer)}. <MathRenderer content={(displayQuestion?.options || []).find((o: any) => o.id === item.userAnswer)?.content || String(item.userAnswer || '')} />
                            </>
                          ) : (
                            <MathRenderer content={String(item.userAnswer || '')} />
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">参考答案</div>
                      {item.userAnswer === null ? (
                        <div className="text-gray-600 dark:text-gray-400">
                          作答后才可查看
                        </div>
                      ) : Array.isArray(item.correctAnswer) ? (
                        <div className="space-y-1">
                          {item.correctAnswer.map((cid: string) => (
                            <div key={cid} className="text-gray-800 dark:text-gray-200">
                              {reviewOptionLabel(displayQuestion?.options, cid)}. <MathRenderer content={(displayQuestion?.options || []).find((o: any) => o.id === cid)?.content || cid} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-800 dark:text-gray-200">
                          {displayQuestion?.options ? (
                            <>
                              {reviewOptionLabel(displayQuestion?.options, item.correctAnswer)}. <MathRenderer content={(displayQuestion?.options || []).find((o: any) => o.id === item.correctAnswer)?.content || String(item.correctAnswer || '')} />
                            </>
                          ) : (
                            <MathRenderer content={String(item.correctAnswer || '')} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <AIChatButton position="static" onClick={() => setShowAIChat(true)} />
            <button
              onClick={() => setIsReviewing(false)}
              className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              返回练习中心
            </button>
          </div>
        </div>
      </QuestionBrowser>
      <AIChatPanel
        isOpen={showAIChat}
        onClose={() => setShowAIChat(false)}
        question={reviewResults[0]?.question || null}
      />
      </>
    );
  }

  return (
    <>
      {!submitOpen && !exitOpen && feedback}
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">练习中心</h1>
        <p className="text-gray-600 dark:text-gray-400">选择专题，开始个性化练习</p>
      </div>

      {hasPausedPractice && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-200">你有一份未完成的练习，已保存答案与当前位置。</p>
          <button type="button" onClick={resumePractice}
            className="rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600 focus-visible:ring-2 focus-visible:ring-amber-500">
            继续上次练习
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">选择练习章节</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">课程</label>
              <select
                disabled={hasPausedPractice}
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">请选择科目</option>
                {subjects.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">章节</label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
                disabled={hasPausedPractice || !selectedSubjectId}
              >
                <option value="">请选择章节</option>
                {chapters(selectedSubjectId).map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">练习设置</h3>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              练习所选章节的全部题目
            </span>
            {selectedChapterId && (
              <span className="text-gray-400 dark:text-gray-500">·</span>
            )}
            {selectedChapterId && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                共 {questionCount} 题
              </span>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">已选课程</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedSubjectId ? (subjects.find(s => s.id === selectedSubjectId)?.name || '-') : '未选择'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">已选章节</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedChapterId ? (topics.find(t => t.id === selectedChapterId)?.name || '-') : '未选择'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">题目数量</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{questionCount} 题</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={hasPausedPractice ? resumePractice : startPractice}
          disabled={loading || memorizationLoading || !selectedSubjectId || !selectedChapterId}
          className="bg-amber-500 text-white py-4 px-6 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-base font-medium"
        >
          <Play className="mr-2 h-5 w-5" />
          {loading ? '准备中...' : hasPausedPractice ? '继续上次练习' : '开始练习'}
        </button>

        <button
          onClick={startMemorization}
          disabled={loading || memorizationLoading || !selectedSubjectId || !selectedChapterId}
          className="border border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 py-4 px-6 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-base font-medium"
        >
          <BookOpen className="mr-2 h-5 w-5" />
          {memorizationLoading ? '加载背题...' : '背题模式'}
        </button>

        <button
          onClick={async () => { const next = !showHistory; setShowHistory(next); if (next) await fetchHistory(); }}
          className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-4 px-6 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center text-base font-medium"
        >
          <BookOpen className="mr-2 h-5 w-5" />
          {showHistory ? '隐藏练习记录' : '查看练习记录'}
        </button>
      </div>

      {showHistory && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">练习记录</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">时间</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">答题数</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">正确数</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {history.map((s: any) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{new Date(s.startTime).toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{s.totalQuestions}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{s.correctCount || 0}</td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={async () => { await fetchPracticeResult(s.id); }}
                        className="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={4}>暂无记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    {submitOpen && (
      <PracticeOverlay>
        <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 border border-gray-200 dark:border-gray-600 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">提交确认</h3>
            {feedback}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">将提交本次练习的所有已答题目。未答题将按空白处理。</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">已答 {questionHistory.filter(q => isAnswered(answersByQuestionId[q.id])).length} / {questionCount}</p>
          <label className="flex items-center space-x-2 mb-4">
            <input type="checkbox" checked={confirmSubmit} onChange={(e) => setConfirmSubmit(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">我已确认上述说明</span>
          </label>
          <div className="flex justify-end space-x-2">
            <button onClick={() => { setSubmitOpen(false); setConfirmSubmit(false); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
            <button
              onClick={async () => {
                if (!confirmSubmit || !practiceSession || !hasAnyAnswer) return;
                const answers = questionHistory
                  .map(q => ({ questionId: q.id, userAnswer: answersByQuestionId[q.id] }))
                  .filter(a => isAnswered(a.userAnswer));
                setLoading(true);
                try {
                  const data = await savePractice(practiceSession.id, answers, true);
                  if (data.success) {
                    setSubmitOpen(false);
                    setConfirmSubmit(false);
                    setIsPracticing(false);
                    await fetchPracticeResult(practiceSession.id);
                  }
                } catch (e) {
                  console.error('提交全部答案失败:', e);
                  notify('提交失败，答案仍保留。请再次点击确认提交重试：' + (e instanceof Error ? e.message : '未知错误'));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={
                !hasAnyAnswer || loading || (
                  !confirmSubmit && (questionHistory.filter(q => isAnswered(answersByQuestionId[q.id])).length < questionCount)
                )
              }
              className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? '提交中...' : '确认提交'}
            </button>
          </div>
        </div>
      </PracticeOverlay>
    )}
    </>
  );
}
