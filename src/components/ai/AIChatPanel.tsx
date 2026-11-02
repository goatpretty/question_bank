import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { X, Send, Bot, Sparkles, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import MathRenderer from '../MathRenderer';
import { aiService } from '../../services/aiService';

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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  boundarySelector?: string;
}

interface Position { x: number; y: number; }

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    single: '单选题', multiple: '多选题', fill: '填空题', subjective: '主观题',
  };
  return map[type] || type;
};

function buildQuestionSummary(q: Question): string {
  let summary = `📋 题目（${getTypeLabel(q.type)}）\n${q.content}`;
  if (q.options && q.options.length > 0) {
    summary += '\n' + q.options.map(o => `${o.id}. ${o.content}`).join('\n');
  }
  return summary;
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown className="ai-markdown">
      {content}
    </ReactMarkdown>
  );
}

export default function AIChatPanel({
  isOpen,
  onClose,
  question,
  boundarySelector = '[data-ai-chat-boundary="practice"]',
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevQuestionIdRef = useRef<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const getDefaultPos = useCallback((): Position => {
    const w = 380, h = 520;
    if (typeof window === 'undefined') return { x: 0, y: 0 };

    const anchor = document.querySelector('[data-ai-chat-button-anchor="practice"]')?.getBoundingClientRect();
    const boundary = document.querySelector(boundarySelector)?.getBoundingClientRect();
    const left = anchor?.left ?? boundary?.left ?? 24;
    const bottom = anchor?.top ?? boundary?.bottom ?? window.innerHeight - 96;

    return {
      x: Math.max(16, Math.min(window.innerWidth - w - 16, left + 56)),
      y: Math.max(16, Math.min(window.innerHeight - h - 16, bottom - h - 16)),
    };
  }, [boundarySelector]);
  const [pos, setPos] = useState<Position>(getDefaultPos);

  useLayoutEffect(() => {
    if (isOpen) {
      setPos(getDefaultPos());
    }
  }, [isOpen, getDefaultPos]);

  useEffect(() => {
    if (!isOpen) return;
    const syncPosition = () => setPos(getDefaultPos());
    window.addEventListener('resize', syncPosition);
    return () => window.removeEventListener('resize', syncPosition);
  }, [isOpen, getDefaultPos]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  // 题目变化时自动发送题目摘要
  useEffect(() => {
    if (!question || !isOpen) return;
    if (question.id === prevQuestionIdRef.current) return;
    prevQuestionIdRef.current = question.id;

    const summary = buildQuestionSummary(question);
    const systemMsg: Message = { id: `sys-${Date.now()}`, role: 'system', content: summary, timestamp: new Date() };
    const assistantMsg: Message = {
      id: `ai-${Date.now()}`, role: 'assistant',
      content: '你好！我是 AI 助手，已收到这道题目。你可以问我：\n\n• 这道题的解题思路\n• 涉及的知识点讲解\n• 类似题目的解法\n• 选项分析\n\n请问有什么想了解的？',
      timestamp: new Date(),
    };
    setMessages([systemMsg, assistantMsg]);
  }, [question, isOpen]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    try {
      const chatMessages = nextMessages
        .filter((msg): msg is Message & { role: 'user' | 'assistant' } => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({ role: msg.role, content: msg.content }));
      const response = await aiService.chat(question, chatMessages);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, role: 'assistant',
        content: response.data.content,
        timestamp: new Date(),
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `ai-error-${Date.now()}`,
        role: 'assistant',
        content: `AI 请求失败：${error instanceof Error ? error.message : '未知错误'}\n\n请稍后重试。`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 - 移动端 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={onClose} />
      )}

      {/* 聊天面板 */}
      <div
        ref={panelRef}
        style={
          isMobile
            ? undefined
            : { position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, width: 380, height: 520 }
        }
        className={cn(
          'flex flex-col bg-white dark:bg-gray-900',
          'border border-gray-200 dark:border-gray-700',
          'shadow-2xl rounded-2xl overflow-hidden',
          'transition-opacity duration-200',
          // 移动端全屏
          isMobile && 'fixed inset-0 z-50 w-full h-full rounded-none',
          'opacity-100',
        )}
      >
        {/* 头部 */}
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800',
            'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">AI 助手</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {question ? getTypeLabel(question.type) : '等待题目...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'system' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">📋 当前题目</span>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                    <MathRenderer content={msg.content.replace(/^📋 题目（.*?）\n/, '')} />
                  </div>
                </div>
              )}

              {msg.role === 'user' && (
                <div className="flex justify-end group">
                  <div className="max-w-[80%]">
                    <div className="bg-blue-500 text-white px-3.5 py-2 rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm">
                      {msg.content}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                      <button onClick={() => handleCopy(msg.id, msg.content)} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                        {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {msg.role === 'assistant' && (
                <div className="flex gap-2 group">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3.5 py-2 rounded-2xl rounded-bl-md text-sm leading-relaxed whitespace-pre-wrap break-words">
                      <MarkdownMessage content={msg.content} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                      <button onClick={() => handleCopy(msg.id, msg.content)} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                        {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 快捷操作 */}
        {messages.length <= 2 && question && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {['这道题怎么做？', '涉及哪些知识点？', '分析一下选项'].map((hint) => (
              <button
                key={hint}
                onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                className="text-xs px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
              >
                {hint}
              </button>
            ))}
          </div>
        )}

        {/* 输入区 */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              rows={1}
              className="flex-1 resize-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all max-h-24 overflow-y-auto"
              style={{ minHeight: '38px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 cursor-pointer',
                input.trim() && !isTyping
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-center">
            Enter 发送 · Shift+Enter 换行
          </p>
        </div>
      </div>
    </>
  );
}
