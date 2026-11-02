import { MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AIChatButtonProps {
  onClick: () => void;
  className?: string;
  position?: 'static';
}

export default function AIChatButton({ onClick, className }: AIChatButtonProps) {
  return (
    <button
      className={cn(
        'relative inline-flex items-center gap-2',
        'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
        'px-4 py-3 rounded-full shadow-lg',
        'hover:from-blue-600 hover:to-blue-700 hover:shadow-xl',
        'cursor-pointer select-none',
        className,
      )}
      data-ai-chat-button-anchor="practice"
      type="button"
      onClick={onClick}
    >
      <MessageCircle className="w-5 h-5 relative z-10" />
      <span className="text-sm font-medium relative z-10">问AI</span>
    </button>
  );
}
