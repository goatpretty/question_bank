import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import { Question, QuestionType, Topic, CreateQuestionData } from '../../../shared/types';

interface QuestionFormModalProps {
  show: boolean;
  onClose: () => void;
  editingQuestion: Question | null;
  formData: CreateQuestionData;
  setFormData: React.Dispatch<React.SetStateAction<CreateQuestionData>>;
  selectedSubjectId: string;
  setSelectedSubjectId: (id: string) => void;
  selectedChapterId: string;
  setSelectedChapterId: (id: string) => void;
  topics: Topic[];
  onSubmit: (e: React.FormEvent) => void;
  onManageTopic: () => void;
}

const questionTypes = [
  { value: 'single', label: '单选题' },
  { value: 'multiple', label: '多选题' },
  { value: 'fill', label: '填空题' },
  { value: 'subjective', label: '主观题' },
];

export default function QuestionFormModal({
  show,
  onClose,
  editingQuestion,
  formData,
  setFormData,
  selectedSubjectId,
  setSelectedSubjectId,
  selectedChapterId,
  setSelectedChapterId,
  topics,
  onSubmit,
  onManageTopic,
}: QuestionFormModalProps) {
  const subjects = topics.filter(t => !t.parentId);

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...(prev.options || []), { id: String.fromCharCode(65 + (prev.options?.length || 0)), content: '' }],
    }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: (prev.options || []).filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: (prev.options || []).map((opt, i) => i === index ? { ...opt, content: value } : opt),
    }));
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {editingQuestion ? '编辑题目' : '新建题目'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form onSubmit={onSubmit} className="space-y-5">
            {/* 题型、科目、章节 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">题型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as QuestionType }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  required
                >
                  {questionTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">科目</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => { setSelectedSubjectId(e.target.value); setSelectedChapterId(''); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  required
                >
                  <option value="">选择科目</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">章节</label>
                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  required
                >
                  <option value="">选择章节</option>
                  {topics.filter(t => t.parentId === selectedSubjectId).map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                <button type="button" onClick={onManageTopic} className="mt-1 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
                  管理科目/章节
                </button>
              </div>
            </div>

            {/* 题目内容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">题目内容</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500 min-h-[120px]"
                required
              />
            </div>

            {/* 选项区 */}
            {(formData.type === 'single' || formData.type === 'multiple') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选项</label>
                <div className="space-y-2">
                  {formData.options?.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-8 flex-shrink-0">{String.fromCharCode(65 + index)}.</span>
                      <input
                        type="text"
                        value={option.content}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                      />
                      {(formData.options?.length || 0) > 2 && (
                        <button type="button" onClick={() => removeOption(index)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 flex-shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addOption} className="mt-2 text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 text-sm flex items-center gap-1">
                  <Plus className="h-4 w-4" /> 添加选项
                </button>
              </div>
            )}

            {/* 答案区 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">正确答案</label>
              {formData.type === 'single' ? (
                <select
                  value={Array.isArray(formData.answer) ? formData.answer[0] : formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  required
                >
                  <option value="">请选择正确答案</option>
                  {formData.options?.map((option, index) => (
                    <option key={index} value={option.id}>{option.id}. {option.content}</option>
                  ))}
                </select>
              ) : formData.type === 'multiple' ? (
                <div className="space-y-2">
                  {formData.options?.map((option, index) => (
                    <label key={index} className="flex items-center text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={Array.isArray(formData.answer) ? formData.answer.includes(option.id) : false}
                        onChange={(e) => {
                          const currentAnswers = Array.isArray(formData.answer) ? formData.answer : [];
                          const newAnswers = e.target.checked
                            ? [...currentAnswers, option.id].sort()
                            : currentAnswers.filter(ans => ans !== option.id);
                          setFormData(prev => ({ ...prev, answer: newAnswers }));
                        }}
                        className="mr-2 rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500"
                      />
                      {option.id}. {option.content}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={Array.isArray(formData.answer) ? formData.answer.join(', ') : formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  placeholder="请输入正确答案"
                  required
                />
              )}
            </div>

            {/* 分数、标签 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分数</label>
                <input
                  type="number"
                  value={formData.score}
                  onChange={(e) => setFormData(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  min="1"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标签</label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  placeholder="请输入标签，用逗号分隔"
                />
              </div>
            </div>

            {/* 解析 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">解析</label>
              <textarea
                value={formData.analysis}
                onChange={(e) => setFormData(prev => ({ ...prev, analysis: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-amber-500 focus:border-amber-500 min-h-[100px]"
                placeholder="请输入题目解析（可选）"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={onSubmit as any}
            className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
