import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getAiSettings } from '../services/systemSettings.js';

const router = Router();

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface QuestionContext {
  type?: string;
  content?: string;
  options?: Array<{ id: string; content: string }>;
  answer?: string | string[];
  analysis?: string;
}

const typeLabel: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  fill: '填空题',
  subjective: '主观题',
};

function buildQuestionContext(question?: QuestionContext | null) {
  if (!question?.content) return '当前没有题目上下文。';

  const label = question.type ? typeLabel[question.type] || question.type : '题目';
  const options = question.options?.length
    ? `\n选项：\n${question.options.map(option => `${option.id}. ${option.content}`).join('\n')}`
    : '';
  const answer = question.answer !== undefined
    ? `\n标准答案：${Array.isArray(question.answer) ? question.answer.join('、') : question.answer}`
    : '';
  const analysis = question.analysis?.trim()
    ? `\n题库解析：${question.analysis.trim()}`
    : '';

  return `题型：${label}\n题干：${question.content}${options}${answer}${analysis}`;
}

function buildSystemPrompt(question?: QuestionContext | null) {
  return [
    '你是一个面向中国高校思政课程题库的学习辅导 AI。',
    '你的任务是基于题干、选项、标准答案和题库解析，帮助学生理解题目。',
    '回答要求：',
    '1. 使用中文，语气清晰、耐心、简洁。',
    '2. 优先讲解解题思路、关键词、相关知识点和选项辨析。',
    '3. 如果学生直接问答案，可以直接给出标准答案，但必须同时解释为什么。',
    '4. 不要编造题目中没有的信息；不确定时明确说明。',
    '5. 对选择题，按选项逐项分析，并说明正确选项和干扰项。',
    '6. 对填空/主观题，结合标准答案给出答题要点和表达模板。',
    '7. 题库解析优先级高于你的泛化知识；不要与标准答案冲突。',
    '8. 不要生成 Markdown 表格或任何表格；需要对比时使用分点列表。',
    '9. 输出结构优先使用短段落、编号列表和项目符号列表。',
    '10. 数学或公式内容保持原格式，避免破坏 LaTeX。',
    '',
    '当前题目上下文：',
    buildQuestionContext(question),
  ].join('\n');
}

router.post('/chat', authMiddleware, async (req: AuthRequest, res) => {
  const settings = getAiSettings();
  const { apiKey, baseUrl, model } = settings;

  if (!settings.enabled) {
    return res.status(503).json({
      success: false,
      error: 'AI 功能未启用，请联系管理员在系统设置中开启。',
    });
  }

  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'AI 服务未配置：缺少 API Key',
    });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages as ChatMessage[] : [];
  const question = req.body?.question as QuestionContext | null | undefined;

  const safeMessages = messages
    .filter(message => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-12)
    .map(message => ({
      role: message.role,
      content: message.content.slice(0, 3000),
    }));

  if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== 'user') {
    return res.status(400).json({
      success: false,
      error: '缺少用户提问内容',
    });
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: buildSystemPrompt(question) },
          ...safeMessages,
        ],
      }),
    });

    interface AiApiResponse {
      error?: { message?: string };
      message?: string;
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    }

    const data = (await response.json().catch(() => null)) as AiApiResponse | null;

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error?.message || data?.message || `AI 请求失败：${response.status}`,
      });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(502).json({
        success: false,
        error: 'AI 返回内容为空',
      });
    }

    res.json({
      success: true,
      data: {
        content: content.trim(),
        model: data?.model || model,
      },
    });
  } catch (error) {
    console.error('AI chat failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI 服务调用失败',
    });
  }
});

export const aiRouter = router;
