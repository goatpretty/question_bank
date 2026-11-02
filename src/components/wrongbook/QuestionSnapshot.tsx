import MathRenderer from '../MathRenderer';
import type { WrongBookAnswer, WrongBookQuestionSnapshot } from '../../../shared/wrongbook';

export function AnswerText({ answer, question }: { answer: WrongBookAnswer; question: WrongBookQuestionSnapshot }) {
  const values = Array.isArray(answer) ? answer : [answer];
  return <div className="space-y-1 break-words">
    {values.filter(value => value.trim()).map((value, index) => {
      const option = question.options.find(item => item.id === value);
      return <div className="flex min-w-0 items-start gap-2" key={`${value}-${index}`}>
        {option ? <><span className="shrink-0 font-semibold">{option.displayLabel}.</span><div className="min-w-0"><MathRenderer content={option.content} /></div></> : <MathRenderer content={value} />}
      </div>;
    })}
    {!values.some(value => value.trim()) && <span>未作答</span>}
  </div>;
}

export default function QuestionSnapshot({ question, userAnswer, correctAnswer = question.answer }: {
  question: WrongBookQuestionSnapshot;
  userAnswer?: WrongBookAnswer;
  correctAnswer?: WrongBookAnswer;
}) {
  const correct = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
  const selected = userAnswer === undefined ? [] : Array.isArray(userAnswer) ? userAnswer : [userAnswer];
  return <div className="min-w-0 space-y-4 text-gray-800 dark:text-gray-200">
    <div className="rounded-lg bg-gray-50 p-4 leading-relaxed break-words dark:bg-gray-900/40"><MathRenderer content={question.content} /></div>
    {!!question.options.length && <div className="grid gap-2 sm:grid-cols-2">
      {question.options.map(option => <div className={`flex min-w-0 items-center gap-2 rounded-lg border p-3 ${correct.includes(option.id)
        ? 'border-green-400 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
        : selected.includes(option.id) ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700'}`} key={option.id}>
        <span className="shrink-0 font-semibold">{option.displayLabel}.</span>
        <div className="min-w-0 flex-1 break-words"><MathRenderer content={option.content} />
          {selected.includes(option.id) && <span className="ml-2 mt-1 inline-block text-xs">你的选择</span>}
        </div>
      </div>)}
    </div>}
    {(!question.options.length || userAnswer !== undefined) && <div className={`grid gap-3 ${userAnswer !== undefined ? 'md:grid-cols-2' : ''}`}>
      {userAnswer !== undefined && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200">
        <h4 className="mb-2 text-sm font-semibold">当次错误答案</h4><AnswerText answer={userAnswer} question={question} />
      </div>}
      {!question.options.length && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200">
        <h4 className="mb-2 text-sm font-semibold">正确答案</h4><AnswerText answer={correctAnswer} question={question} />
      </div>}
    </div>}
  </div>;
}
