import { BaseService } from './baseService';

interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIQuestionContext {
  id: string;
  type: 'single' | 'multiple' | 'fill' | 'subjective';
  content: string;
  options?: { id: string; content: string }[];
  answer: string | string[];
  analysis?: string;
}

interface AIChatResponse {
  success: boolean;
  data: {
    content: string;
    model: string;
  };
}

class AIService extends BaseService {
  constructor() {
    super('ai');
  }

  chat(question: AIQuestionContext | null, messages: AIChatMessage[]) {
    return this.post<AIChatResponse>(`${this.apiBase}/chat`, {
      question,
      messages,
    });
  }
}

export const aiService = new AIService();
