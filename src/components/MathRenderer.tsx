import { Fragment, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  className?: string;
}

interface MathSegment {
  type: 'math';
  value: string;
  display: boolean;
}

interface TextSegment {
  type: 'text';
  value: string;
}

type Segment = MathSegment | TextSegment;

/**
 * 将文本拆分为普通文本与公式片段。
 * 仅公式片段交给 KaTeX 生成 HTML，普通文本始终由 React 转义后渲染。
 */
function parseContent(content: string): Segment[] {
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$/g;
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, index) });
    }

    const displayValue = match[1] ?? match[2];
    const inlineValue = match[3];
    segments.push({
      type: 'math',
      value: displayValue ?? inlineValue ?? '',
      display: displayValue !== undefined,
    });

    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return segments;
}

function renderMath(segment: MathSegment): string {
  try {
    return katex.renderToString(segment.value, {
      displayMode: segment.display,
      throwOnError: false,
      trust: false,
      strict: 'ignore',
    });
  } catch (error) {
    console.error('KaTeX rendering error:', error);
    return '';
  }
}

function TextSegment({ value }: { value: string }) {
  return (
    <>
      {value.split('\n').map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}

export default function MathRenderer({ content, className = '' }: MathRendererProps) {
  const segments = useMemo(() => parseContent(content), [content]);

  return (
    <div className={`math-renderer ${className}`}>
      {segments.map((segment, index) => (
        segment.type === 'text'
          ? <TextSegment key={index} value={segment.value} />
          : (
            <span
              dangerouslySetInnerHTML={{ __html: renderMath(segment) }}
              key={index}
            />
          )
      ))}
    </div>
  );
}
