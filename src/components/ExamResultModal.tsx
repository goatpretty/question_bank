import { createPortal } from 'react-dom';
import MathRenderer from './MathRenderer';
import { ExamQuestionResult } from '../../shared/types';
import { X } from 'lucide-react';

interface ExamResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  examName?: string;
  result: any | null;
}

function toPercent(score: number, maxScore: number): number {
  if (!maxScore || maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}

function formatAnswerDisplay(answer: string | string[] | null | undefined): string {
  if (!answer) return '未作答';
  if (Array.isArray(answer)) return answer.join('、');
  return String(answer);
}

export default function ExamResultModal({ isOpen, onClose, examName, result }: ExamResultModalProps) {
  if (!isOpen || !result) return null;

  const totalScore = result.totalScore ?? 0;
  const maxScore = result.maxScore ?? 0;
  const percent = toPercent(totalScore, maxScore);
  const questionCount = result.questionCount || '';

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{examName}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {percent} 分 · 原始分 {totalScore}/{maxScore}
                {questionCount && ` · 题目 ${questionCount}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {result.results?.map((r: ExamQuestionResult, idx: number) => (
            <div key={idx} className={`border rounded-lg p-4 ${r.isCorrect ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isCorrect ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                  {r.isCorrect ? '正确' : '错误'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">第 {r.order} 题 · 得分 {r.score} / {r.maxScore}</span>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded p-3 mb-3 border border-gray-100 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                  {r.type === 'single' ? '单选题' : r.type === 'multiple' ? '多选题' : r.type === 'fill' ? '填空题' : '主观题'}
                </div>
                <div className="prose max-w-none dark:prose-invert">
                  <MathRenderer content={r.content} />
                </div>
              </div>

              {r.options && r.options.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">选项：</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {r.options.map((opt: any, oIdx: number) => {
                      const label = opt.displayLabel || String.fromCharCode(65 + oIdx);
                      const isCorrectAnswer = Array.isArray(r.correctAnswer)
                        ? r.correctAnswer.includes(label)
                        : r.correctAnswer === label;
                      const isUserAnswer = r.userAnswer
                        ? (Array.isArray(r.userAnswer)
                          ? r.userAnswer.includes(label)
                          : r.userAnswer === label)
                        : false;

                      let bgColor = 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600';
                      if (isCorrectAnswer && isUserAnswer) bgColor = 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-700';
                      else if (isCorrectAnswer) bgColor = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800';
                      else if (isUserAnswer) bgColor = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800';

                      return (
                        <div key={opt.id} className={`text-sm px-3 py-2 rounded border ${bgColor}`}>
                          <span className="font-medium mr-1 text-gray-700 dark:text-gray-300">{label}.</span>
                          <span className="text-gray-700 dark:text-gray-300"><MathRenderer content={opt.content} /></span>
                          {isCorrectAnswer && <span className="ml-2 text-green-600 dark:text-green-400 text-xs">正确答案</span>}
                          {isUserAnswer && !isCorrectAnswer && <span className="ml-2 text-red-600 dark:text-red-400 text-xs">你的选择</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 text-sm mb-2">
                <div className="text-green-700 dark:text-green-400">
                  参考答案：<span className="font-medium">{formatAnswerDisplay(r.correctAnswer)}</span>
                </div>
                <div className="text-amber-700 dark:text-amber-400">
                  你的答案：<span className="font-medium">{formatAnswerDisplay(r.userAnswer)}</span>
                </div>
              </div>

              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 rounded p-3 border border-gray-100 dark:border-gray-600">
                <span className="font-medium text-gray-700 dark:text-gray-300">解析：</span>
                <div className="prose max-w-none dark:prose-invert mt-1">
                  <MathRenderer content={r.analysis || '暂无解析'} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
