import { BookOpen } from 'lucide-react';
import MathRenderer from './MathRenderer';
import QuestionBrowser from './QuestionBrowser';

interface MemorizationQuestion {
  id: string;
  type: 'single' | 'multiple' | 'fill' | 'subjective';
  content: string;
  options?: { id: string; content: string }[];
  answer: string | string[];
}

const typeLabels = { single: '单选题', multiple: '多选题', fill: '填空题', subjective: '主观题' };

export default function Memorization({ questions, chapterName, onClose }: {
  questions: MemorizationQuestion[];
  chapterName: string;
  onClose: () => void;
}) {
  return (
    <QuestionBrowser items={questions.map(question => ({ id: question.id, status: 'study' }))} subtitle={`${chapterName} · 共 ${questions.length} 题`} title="背题模式" onClose={onClose}>
      <div className="space-y-4">
        {questions.map((question, index) => {
          const choice = question.type === 'single' || question.type === 'multiple';
          const answers = Array.isArray(question.answer) ? question.answer : [question.answer];
          return (
            <article aria-label={`第 ${index + 1} 题`} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-w-0 text-gray-700 dark:text-gray-300"
              data-question-index={index} key={question.id} tabIndex={-1}>
              <span className="inline-flex px-2.5 py-0.5 mb-2 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">{typeLabels[question.type]}</span>
              <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-3 break-words">
                <MathRenderer content={question.content} />
              </div>
              {choice && question.options?.length ? (
                <>
                  <div className="text-sm font-medium mb-2">选项</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[...question.options].sort((a, b) => a.id.localeCompare(b.id)).map((option, optionIndex) => {
                      const correct = answers.includes(option.id);
                      return (
                        <div className={`px-3 py-2 border rounded-md flex items-start gap-2 min-w-0 ${correct
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                          : 'border-gray-300 dark:border-gray-600'}`} key={option.id}>
                          <span className={`font-medium ${correct ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {String.fromCharCode(65 + optionIndex)}.<span className="sr-only">{correct ? '正确答案' : ''}</span>
                          </span>
                          <div className="min-w-0 break-words"><MathRenderer content={option.content} /></div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-amber-500 bg-amber-50 dark:bg-amber-900/30 p-3 break-words">
                  {answers.map((answer, answerIndex) => <MathRenderer content={answer} key={answerIndex} />)}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <button className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" type="button"
        onClick={onClose}>
        <BookOpen className="w-4 h-4" />返回练习中心
      </button>
    </QuestionBrowser>
  );
}
