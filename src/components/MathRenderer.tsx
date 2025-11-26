import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  className?: string;
}

export default function MathRenderer({ content, className = '' }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderMath = () => {
      const container = containerRef.current;
      if (!container) return;

      // 处理行内公式 $...$
      const inlineMathRegex = /\$([^$]+)\$/g;
      // 处理块级公式 $$...$$ 或 \[...\]
      const blockMathRegex = /\$\$([^$]+)\$\$|\\\[([^\]]+)\\\]/g;

      let processedContent = content;

      // 先处理块级公式
      processedContent = processedContent.replace(blockMathRegex, (match, p1, p2) => {
        const formula = p1 || p2;
        try {
          return katex.renderToString(formula, {
            displayMode: true,
            throwOnError: false,
            trust: true
          });
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          return `<span class="text-red-500 bg-red-50 px-2 py-1 rounded">公式渲染错误: ${formula}</span>`;
        }
      });

      // 处理行内公式
      processedContent = processedContent.replace(inlineMathRegex, (match, p1) => {
        try {
          return katex.renderToString(p1, {
            displayMode: false,
            throwOnError: false,
            trust: true
          });
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          return `<span class="text-red-500 bg-red-50 px-1 rounded text-sm">公式错误: ${p1}</span>`;
        }
      });

      container.innerHTML = processedContent;
    };

    renderMath();
  }, [content]);

  return (
    <div 
      ref={containerRef} 
      className={`math-renderer ${className}`}
    />
  );
}